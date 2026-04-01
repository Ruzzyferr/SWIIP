import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../redis/redis.service';
import { WsException } from '@nestjs/websockets';
import { JwtPayload } from '../auth.service';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client = context.switchToWs().getClient();
      const token =
        client.handshake?.query?.token ||
        client.handshake?.auth?.token ||
        client.handshake?.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        throw new WsException('No token provided');
      }

      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const sessionData = await this.redis.get(`session:${payload.sessionId}`);
      if (!sessionData) {
        throw new WsException('Session expired or revoked');
      }

      const parsed = JSON.parse(sessionData);
      if (parsed.userId !== payload.sub) {
        throw new WsException('Session mismatch');
      }

      client.data = { userId: payload.sub, sessionId: payload.sessionId };
      return true;
    } catch (err) {
      if (err instanceof WsException) throw err;
      throw new WsException('Invalid token');
    }
  }
}
