import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../redis/redis.service';
import { JwtPayload, AuthUser } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
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

    if (!sessionData) {
      throw new UnauthorizedException('Session expired or revoked');
    }

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
}
