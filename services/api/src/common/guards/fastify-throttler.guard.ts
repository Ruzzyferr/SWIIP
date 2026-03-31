import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Fastify-aware throttler guard.
 * The default ThrottlerGuard is built for Express; this override exposes
 * the raw Fastify request/reply objects so the guard can set rate-limit
 * response headers correctly.
 */
@Injectable()
export class FastifyThrottlerGuard extends ThrottlerGuard {
  getRequestResponse(context: ExecutionContext) {
    const ctx = context.switchToHttp();
    return { req: ctx.getRequest(), res: ctx.getResponse() };
  }
}
