import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers?.['x-internal-token'];
    const secret = this.config.get<string>('INTERNAL_TOKEN') ?? this.config.get<string>('JWT_SECRET');
    if (!token || !secret || token !== secret) {
      throw new ForbiddenException('Invalid internal token');
    }
    return true;
  }
}
