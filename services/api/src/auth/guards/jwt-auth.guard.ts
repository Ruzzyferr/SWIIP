import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthUser } from '../auth.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    return super.canActivate(context);
  }

  handleRequest<TUser = AuthUser>(
    err: unknown,
    user: unknown,
    info: unknown,
    _context: ExecutionContext,
    _status?: unknown,
  ): TUser {
    if (err || user == null || user === false) {
      let msg = 'Unauthorized';
      if (info && typeof info === 'object' && 'message' in info) {
        const m = (info as { message?: unknown }).message;
        if (typeof m === 'string') msg = m;
      }
      if (err instanceof Error) throw err;
      throw new UnauthorizedException(msg);
    }
    return user as TUser;
  }
}
