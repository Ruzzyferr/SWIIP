import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GuildId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.params?.guildId || request.params?.id;
  },
);
