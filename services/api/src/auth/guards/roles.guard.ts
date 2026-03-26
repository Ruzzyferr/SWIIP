import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { REQUIRED_ROLES_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const guildId = request.params?.guildId || request.params?.id;

    if (!user || !guildId) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const member = await this.prisma.guildMember.findUnique({
      where: {
        guildId_userId: { guildId, userId: user.userId },
      },
      include: {
        guild: { select: { ownerId: true } },
      },
    });

    if (!member) {
      throw new ForbiddenException('Not a member of this guild');
    }

    if (member.guild.ownerId === user.userId) {
      return true;
    }

    const memberRoles = new Set(member.roles);
    const hasRole = requiredRoles.some((role) => memberRoles.has(role));

    if (!hasRole) {
      throw new ForbiddenException('Insufficient role permissions');
    }

    return true;
  }
}
