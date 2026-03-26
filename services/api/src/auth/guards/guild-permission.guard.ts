import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsService } from '../../permissions/permissions.service';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class GuildPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<bigint[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const guildId = request.params?.guildId || request.params?.id;
    const channelId = request.params?.channelId;

    if (!user || !guildId) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const effectivePermissions = await this.permissionsService.computePermissionsForUser(
      user.userId,
      guildId,
      channelId,
    );

    if (this.permissionsService.isAdministrator(effectivePermissions)) {
      return true;
    }

    for (const permission of requiredPermissions) {
      if (!this.permissionsService.hasPermission(effectivePermissions, permission)) {
        throw new ForbiddenException(
          `Missing required permission: ${permission.toString()}`,
        );
      }
    }

    return true;
  }
}
