import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../redis/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload, AuthUser } from '../auth.service';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 90;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: (() => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) throw new Error('JWT_SECRET environment variable is required');
        return secret;
      })(),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const sessionKey = `session:${payload.sessionId}`;
    const sessionData = await this.redis.get(sessionKey);

    if (sessionData) {
      let parsed: { userId: string; sessionId: string };
      try {
        parsed = JSON.parse(sessionData);
      } catch {
        throw new UnauthorizedException('Invalid session data');
      }

      if (parsed.userId !== payload.sub) {
        throw new UnauthorizedException('Session mismatch');
      }

      return { userId: payload.sub, sessionId: payload.sessionId };
    }

    // Redis miss: fall back to DB so a Redis flush/eviction does not log out
    // every active user. Re-cache the session for subsequent requests.
    const session = await this.prisma.session.findFirst({
      where: {
        id: payload.sessionId,
        isValid: true,
        expiresAt: { gt: new Date() },
      },
      select: { userId: true },
    });

    if (!session || session.userId !== payload.sub) {
      throw new UnauthorizedException('Session expired or revoked');
    }

    await this.redis.setex(
      sessionKey,
      SESSION_TTL_SECONDS,
      JSON.stringify({ userId: session.userId, sessionId: payload.sessionId }),
    );

    return { userId: session.userId, sessionId: payload.sessionId };
  }
}
