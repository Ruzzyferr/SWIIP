import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { nanoid } from 'nanoid';
import { randomInt } from 'crypto';
import { RegisterDto } from './dto/auth.dto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  sessionId: string;
  iat?: number;
  exp?: number;
}

export interface AuthUser {
  userId: string;
  sessionId: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly BCRYPT_ROUNDS = 12;
  private readonly SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
  private readonly EMAIL_VERIFY_TTL = 60 * 10; // 10 minutes
  private readonly EMAIL_VERIFY_MAX_ATTEMPTS = 5;
  private readonly EMAIL_RESEND_COOLDOWN = 60; // 60 seconds
  private readonly PASSWORD_RESET_TTL = 60 * 60; // 1 hour

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly emailService: EmailService,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: any; tokens: TokenPair; sessionId: string }> {
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingEmail) {
      throw new ConflictException('Email already registered');
    }

    const discriminator = await this.generateUniqueDiscriminator(dto.username);
    const passwordHash = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        discriminator,
        passwordHash,
        presenceState: {
          create: {
            status: 'OFFLINE',
          },
        },
      },
      select: {
        id: true,
        email: true,
        username: true,
        discriminator: true,
        globalName: true,
        avatarId: true,
        flags: true,
        verified: true,
        mfaEnabled: true,
        createdAt: true,
      },
    });

    // Generate 6-digit verification code and send email
    const code = String(randomInt(100000, 1000000));
    await this.redis.setex(
      `email:verify:code:${user.id}`,
      this.EMAIL_VERIFY_TTL,
      code,
    );
    await this.redis.setex(
      `email:verify:attempts:${user.id}`,
      this.EMAIL_VERIFY_TTL,
      '0',
    );

    try {
      await this.emailService.sendVerificationCode(user.email, code, user.username);
    } catch {
      this.logger.warn(`Failed to send verification email to ${user.email}, user can resend later`);
    }

    this.eventEmitter.emit('user.registered', {
      userId: user.id,
      email: user.email,
      username: user.username,
    });

    const session = await this.createSession(user.id);
    const tokens = await this.generateTokenPair(user.id, session.id);

    // Store the actual JWT refresh token in the session record
    await this.prisma.session.update({
      where: { id: session.id },
      data: { refreshToken: tokens.refreshToken },
    });

    // Store session in Redis so JWT strategy can validate it
    await this.redis.setex(
      `session:${session.id}`,
      this.SESSION_TTL_SECONDS,
      JSON.stringify({ userId: user.id, sessionId: session.id }),
    );

    this.logger.log(`User registered: ${user.email}`);
    return { user, tokens, sessionId: session.id };
  }

  async login(
    email: string,
    password: string,
    mfaCode?: string,
    deviceInfo?: {
      deviceName?: string;
      deviceOs?: string;
      browser?: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<{ user: any; tokens: TokenPair; sessionId: string }> {
    const user = await this.validateUser(email, password);

    if (user.mfaEnabled) {
      if (!mfaCode) {
        throw new UnauthorizedException('MFA code required');
      }
      const mfaValid = await this.validateMFACode(user.id, mfaCode);
      if (!mfaValid) {
        throw new UnauthorizedException('Invalid MFA code');
      }
    }

    const session = await this.createSession(user.id, deviceInfo);
    const tokens = await this.generateTokenPair(user.id, session.id);

    // Store the actual JWT refresh token in the session record
    await this.prisma.session.update({
      where: { id: session.id },
      data: { refreshToken: tokens.refreshToken },
    });

    await this.redis.setex(
      `session:${session.id}`,
      this.SESSION_TTL_SECONDS,
      JSON.stringify({ userId: user.id, sessionId: session.id }),
    );

    const safeUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      discriminator: user.discriminator,
      globalName: user.globalName,
      avatarId: user.avatarId,
      flags: user.flags,
      verified: user.verified,
      mfaEnabled: user.mfaEnabled,
      locale: user.locale,
      premiumType: user.premiumType,
      createdAt: user.createdAt,
    };

    // If the user hasn't verified their email yet, send a fresh verification code
    if (!user.verified) {
      const code = String(randomInt(100000, 1000000));
      await this.redis.setex(
        `email:verify:code:${user.id}`,
        this.EMAIL_VERIFY_TTL,
        code,
      );
      await this.redis.setex(
        `email:verify:attempts:${user.id}`,
        this.EMAIL_VERIFY_TTL,
        '0',
      );
      await this.redis.setex(
        `email:verify:cooldown:${user.id}`,
        this.EMAIL_RESEND_COOLDOWN,
        '1',
      );
      try {
        await this.emailService.sendVerificationCode(user.email, code, user.username);
      } catch {
        this.logger.warn(`Failed to send verification email on login to ${user.email}`);
      }
    }

    this.logger.log(`User logged in: ${user.email}`);
    return { user: safeUser, tokens, sessionId: session.id };
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const session = await this.prisma.session.findFirst({
      where: { id: payload.sessionId, refreshToken, isValid: true },
    });

    if (!session) {
      throw new UnauthorizedException('Session not found or revoked');
    }

    if (session.expiresAt < new Date()) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { isValid: false },
      });
      throw new UnauthorizedException('Session expired');
    }

    const newTokens = await this.generateTokenPair(session.userId, session.id);

    const newRefreshToken = newTokens.refreshToken;
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshToken: newRefreshToken,
        lastUsedAt: new Date(),
      },
    });

    await this.redis.setex(
      `session:${session.id}`,
      this.SESSION_TTL_SECONDS,
      JSON.stringify({ userId: session.userId, sessionId: session.id }),
    );

    return newTokens;
  }

  async revokeSessionForUser(userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    if (session.userId !== userId) {
      throw new UnauthorizedException('Cannot revoke a session that does not belong to you');
    }
    await this.logout(sessionId);
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { isValid: false },
    });
    await this.redis.del(`session:${sessionId}`);
    this.logger.log(`Session revoked: ${sessionId}`);
  }

  async revokeAllSessions(userId: string, exceptSessionId?: string): Promise<void> {
    const where = exceptSessionId
      ? { userId, isValid: true, id: { not: exceptSessionId } }
      : { userId, isValid: true };

    const sessions = await this.prisma.session.findMany({
      where,
      select: { id: true },
    });

    await this.prisma.session.updateMany({
      where,
      data: { isValid: false },
    });

    const redisDeleteKeys = sessions.map((s: { id: string }) => `session:${s.id}`);
    if (redisDeleteKeys.length > 0) {
      await this.redis.del(...redisDeleteKeys);
    }

    this.logger.log(`Revoked ${sessions.length} sessions for user: ${userId}`);
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  async generateTokenPair(userId: string, sessionId: string): Promise<TokenPair> {
    const payload: JwtPayload = { sub: userId, sessionId };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRY', '15m'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRY', '30d'),
    });

    return { accessToken, refreshToken };
  }

  async verifyEmailCode(userId: string, code: string): Promise<{ verified: boolean }> {
    const storedCode = await this.redis.get(`email:verify:code:${userId}`);
    if (!storedCode) {
      throw new BadRequestException('No verification code found. Please request a new one.');
    }

    const attempts = parseInt(await this.redis.get(`email:verify:attempts:${userId}`) || '0', 10);
    if (attempts >= this.EMAIL_VERIFY_MAX_ATTEMPTS) {
      await this.redis.del(`email:verify:code:${userId}`);
      await this.redis.del(`email:verify:attempts:${userId}`);
      throw new BadRequestException('Too many attempts. Please request a new code.');
    }

    await this.redis.setex(
      `email:verify:attempts:${userId}`,
      this.EMAIL_VERIFY_TTL,
      String(attempts + 1),
    );

    if (code !== storedCode) {
      throw new BadRequestException('Invalid verification code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { verified: true },
    });

    await this.redis.del(`email:verify:code:${userId}`);
    await this.redis.del(`email:verify:attempts:${userId}`);
    await this.redis.del(`email:verify:cooldown:${userId}`);
    this.logger.log(`Email verified for user: ${userId}`);
    return { verified: true };
  }

  async resendVerificationCode(userId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, username: true, verified: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.verified) throw new BadRequestException('Email is already verified');

    const cooldown = await this.redis.get(`email:verify:cooldown:${userId}`);
    if (cooldown) {
      throw new BadRequestException('Please wait before requesting a new code');
    }

    const code = String(randomInt(100000, 1000000));
    await this.redis.setex(`email:verify:code:${userId}`, this.EMAIL_VERIFY_TTL, code);
    await this.redis.setex(`email:verify:attempts:${userId}`, this.EMAIL_VERIFY_TTL, '0');
    await this.redis.setex(`email:verify:cooldown:${userId}`, this.EMAIL_RESEND_COOLDOWN, '1');

    try {
      await this.emailService.sendVerificationCode(user.email, code, user.username);
    } catch {
      this.logger.warn(`Failed to resend verification email to ${user.email}`);
      throw new BadRequestException('Failed to send verification email. Please try again.');
    }
    this.logger.log(`Verification code resent to ${user.email}`);
    return { message: 'Verification code sent' };
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Return silently to prevent email enumeration
      return;
    }

    const resetToken = nanoid(32);
    await this.redis.setex(
      `password:reset:${resetToken}`,
      this.PASSWORD_RESET_TTL,
      user.id,
    );

    this.eventEmitter.emit('user.passwordResetRequested', {
      userId: user.id,
      email: user.email,
      resetToken,
    });

    this.logger.log(`Password reset requested for: ${email}`);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const userId = await this.redis.get(`password:reset:${token}`);
    if (!userId) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, this.BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.redis.del(`password:reset:${token}`);
    await this.revokeAllSessions(userId);

    this.logger.log(`Password reset for user: ${userId}`);
  }

  async setupMFA(userId: string): Promise<{ secret: string; qrCodeUrl: string; otpauthUrl: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.mfaEnabled) throw new BadRequestException('MFA is already enabled');

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(user.email, 'Swiip', secret);
    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

    await this.redis.setex(`mfa:setup:${userId}`, 300, secret);

    return { secret, qrCodeUrl, otpauthUrl };
  }

  async enableMFA(userId: string, code: string): Promise<{ backupCodes: string[] }> {
    const secret = await this.redis.get(`mfa:setup:${userId}`);
    if (!secret) {
      throw new BadRequestException('MFA setup session expired. Please start over.');
    }

    const isValid = authenticator.verify({ token: code, secret });
    if (!isValid) {
      throw new BadRequestException('Invalid TOTP code');
    }

    const backupCodes = Array.from({ length: 10 }, () => nanoid(10));
    const hashedBackupCodes = await Promise.all(
      backupCodes.map((c) => bcrypt.hash(c, 10)),
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: true,
        mfaSecret: secret,
        mfaBackupCodes: hashedBackupCodes,
      },
    });

    await this.redis.del(`mfa:setup:${userId}`);
    this.logger.log(`MFA enabled for user: ${userId}`);

    return { backupCodes };
  }

  async disableMFA(userId: string, code: string): Promise<void> {
    const isValid = await this.validateMFACode(userId, code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid MFA code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: [],
      },
    });

    this.logger.log(`MFA disabled for user: ${userId}`);
  }

  async validateMFACode(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaSecret: true, mfaBackupCodes: true },
    });

    if (!user?.mfaSecret) return false;

    // Check TOTP first
    const isTotpValid = authenticator.verify({
      token: code,
      secret: user.mfaSecret,
    });
    if (isTotpValid) return true;

    // Check backup codes
    for (let i = 0; i < user.mfaBackupCodes.length; i++) {
      const isBackupValid = await bcrypt.compare(code, user.mfaBackupCodes[i]!);
      if (isBackupValid) {
        // Remove used backup code
        const updatedCodes = user.mfaBackupCodes.filter((_: string, idx: number) => idx !== i);
        await this.prisma.user.update({
          where: { id: userId },
          data: { mfaBackupCodes: updatedCodes },
        });
        return true;
      }
    }

    return false;
  }

  async getSessions(userId: string): Promise<any[]> {
    return this.prisma.session.findMany({
      where: { userId, isValid: true },
      select: {
        id: true,
        deviceName: true,
        deviceOs: true,
        browser: true,
        ipAddress: true,
        lastUsedAt: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { lastUsedAt: 'desc' },
    });
  }

  private async createSession(
    userId: string,
    deviceInfo?: {
      deviceName?: string;
      deviceOs?: string;
      browser?: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ) {
    const expiresAt = new Date(Date.now() + this.SESSION_TTL_SECONDS * 1000);
    const tokenPlaceholder = nanoid(32);

    const session = await this.prisma.session.create({
      data: {
        userId,
        token: tokenPlaceholder,
        refreshToken: nanoid(32),
        expiresAt,
        deviceName: deviceInfo?.deviceName,
        deviceOs: deviceInfo?.deviceOs,
        browser: deviceInfo?.browser,
        ipAddress: deviceInfo?.ipAddress,
        userAgent: deviceInfo?.userAgent,
      },
    });

    return session;
  }

  private async generateUniqueDiscriminator(username: string): Promise<string> {
    for (let attempts = 0; attempts < 10; attempts++) {
      const discriminator = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
      const existing = await this.prisma.user.findUnique({
        where: { username_discriminator: { username, discriminator } },
      });
      if (!existing) return discriminator;
    }
    throw new ConflictException('Unable to generate unique discriminator. Try a different username.');
  }
}
