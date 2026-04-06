import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma, type Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PermissionsService, Permissions } from '../permissions/permissions.service';
import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty() @IsString() @MaxLength(100) name: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(16777215) color?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hoist?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() mentionable?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() selfAssignable?: boolean;
  @ApiPropertyOptional() @IsOptional() permissions?: string;
}

export class UpdateRoleDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(16777215) color?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hoist?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() mentionable?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() selfAssignable?: boolean;
  @ApiPropertyOptional() @IsOptional() permissions?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() icon?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() unicodeEmoji?: string;
}

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly permissionsService: PermissionsService,
  ) {}

  /**
   * Ensures the actor's highest role position is above the target role's position.
   * Guild owners bypass this check. Throws ForbiddenException if hierarchy is violated.
   */
  private async assertRoleHierarchy(
    actorId: string,
    guildId: string,
    targetRolePosition: number,
  ): Promise<void> {
    const guild = await this.prisma.guild.findUnique({
      where: { id: guildId },
      select: { ownerId: true },
    });

    if (!guild) throw new NotFoundException('Guild not found');

    // Guild owner bypasses hierarchy checks
    if (guild.ownerId === actorId) return;

    // Get the actor's member record to find their roles
    const member = await this.prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: actorId } },
      select: { roles: true },
    });

    if (!member || member.roles.length === 0) {
      throw new ForbiddenException(
        'You do not have any roles with a high enough position to perform this action',
      );
    }

    // Get the highest position among the actor's roles
    const actorRoles = await this.prisma.role.findMany({
      where: { id: { in: member.roles }, guildId },
      select: { position: true },
      orderBy: { position: 'desc' },
      take: 1,
    });

    const actorHighestPosition = actorRoles.length > 0 ? actorRoles[0]!.position : 0;

    if (targetRolePosition >= actorHighestPosition) {
      throw new ForbiddenException(
        'You cannot manage a role that is equal to or higher than your highest role',
      );
    }
  }

  private parseBigIntPermissions(value: string): bigint {
    try {
      return BigInt(value);
    } catch {
      throw new BadRequestException('Invalid permissions value');
    }
  }

  /** Map Prisma Role (permissionsInteger) → RolePayload (permissions) */
  private serializeRole(role: Role) {
    const { permissionsInteger, ...rest } = role;
    return { ...rest, permissions: (permissionsInteger ?? 0n).toString() };
  }

  async create(guildId: string, actorId: string, dto: CreateRoleDto) {
    const perms = await this.permissionsService.computePermissionsForUser(actorId, guildId);
    if (
      !this.permissionsService.isAdministrator(perms) &&
      !this.permissionsService.hasPermission(perms, Permissions.MANAGE_ROLES)
    ) {
      throw new ForbiddenException('Missing MANAGE_ROLES permission');
    }

    const maxPosition = await this.prisma.role.aggregate({
      where: { guildId },
      _max: { position: true },
    });

    const newPosition = (maxPosition._max.position ?? 0) + 1;

    // Ensure the actor's highest role is above the new role's position
    await this.assertRoleHierarchy(actorId, guildId, newPosition);

    const role = await this.prisma.role.create({
      data: {
        guildId,
        name: dto.name,
        color: dto.color ?? 0,
        hoist: dto.hoist ?? false,
        mentionable: dto.mentionable ?? false,
        selfAssignable: dto.selfAssignable ?? false,
        permissionsInteger: dto.permissions ? this.parseBigIntPermissions(dto.permissions) : 0n,
        position: newPosition,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        guildId,
        actorId,
        targetId: role.id,
        targetType: 'ROLE',
        action: 'ROLE_CREATE',
      },
    });

    this.eventEmitter.emit('role.created', { guildId, roleId: role.id, actorId });
    return this.serializeRole(role);
  }

  async update(roleId: string, guildId: string, actorId: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findFirst({ where: { id: roleId, guildId } });
    if (!role) throw new NotFoundException('Role not found');

    const perms = await this.permissionsService.computePermissionsForUser(actorId, guildId);
    if (
      !this.permissionsService.isAdministrator(perms) &&
      !this.permissionsService.hasPermission(perms, Permissions.MANAGE_ROLES)
    ) {
      throw new ForbiddenException('Missing MANAGE_ROLES permission');
    }

    // Enforce role hierarchy: actor's highest role must be above the target role
    await this.assertRoleHierarchy(actorId, guildId, role.position);

    const updated = await this.prisma.role.update({
      where: { id: roleId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.hoist !== undefined && { hoist: dto.hoist }),
        ...(dto.mentionable !== undefined && { mentionable: dto.mentionable }),
        ...(dto.selfAssignable !== undefined && { selfAssignable: dto.selfAssignable }),
        ...(dto.permissions !== undefined && { permissionsInteger: this.parseBigIntPermissions(dto.permissions) }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.unicodeEmoji !== undefined && { unicodeEmoji: dto.unicodeEmoji }),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        guildId,
        actorId,
        targetId: roleId,
        targetType: 'ROLE',
        action: 'ROLE_UPDATE',
        changes: dto as Prisma.InputJsonValue,
      },
    });

    this.eventEmitter.emit('role.updated', { guildId, roleId, actorId });
    return this.serializeRole(updated);
  }

  async delete(roleId: string, guildId: string, actorId: string) {
    const role = await this.prisma.role.findFirst({ where: { id: roleId, guildId } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.name === '@everyone') throw new BadRequestException('Cannot delete @everyone role');
    if (role.managed) throw new BadRequestException('Cannot delete a managed role');

    const perms = await this.permissionsService.computePermissionsForUser(actorId, guildId);
    if (
      !this.permissionsService.isAdministrator(perms) &&
      !this.permissionsService.hasPermission(perms, Permissions.MANAGE_ROLES)
    ) {
      throw new ForbiddenException('Missing MANAGE_ROLES permission');
    }

    // Enforce role hierarchy: actor's highest role must be above the target role
    await this.assertRoleHierarchy(actorId, guildId, role.position);

    await this.prisma.role.delete({ where: { id: roleId } });

    await this.prisma.auditLog.create({
      data: {
        guildId,
        actorId,
        targetId: roleId,
        targetType: 'ROLE',
        action: 'ROLE_DELETE',
      },
    });

    this.eventEmitter.emit('role.deleted', { guildId, roleId, actorId });
    return { message: 'Role deleted' };
  }

  async reorder(guildId: string, actorId: string, positions: Array<{ id: string; position: number }>) {
    const perms = await this.permissionsService.computePermissionsForUser(actorId, guildId);
    if (
      !this.permissionsService.isAdministrator(perms) &&
      !this.permissionsService.hasPermission(perms, Permissions.MANAGE_ROLES)
    ) {
      throw new ForbiddenException('Missing MANAGE_ROLES permission');
    }

    await this.prisma.$transaction(
      positions.map((p) =>
        this.prisma.role.update({
          where: { id: p.id },
          data: { position: p.position },
        }),
      ),
    );

    const reordered = await this.prisma.role.findMany({
      where: { guildId },
      orderBy: { position: 'asc' },
    });
    return reordered.map((r) => this.serializeRole(r));
  }

  async addMemberRole(guildId: string, memberId: string, roleId: string, actorId: string) {
    const role = await this.prisma.role.findFirst({ where: { id: roleId, guildId } });
    if (!role) throw new NotFoundException('Role not found');

    const perms = await this.permissionsService.computePermissionsForUser(actorId, guildId);
    if (
      !this.permissionsService.isAdministrator(perms) &&
      !this.permissionsService.hasPermission(perms, Permissions.MANAGE_ROLES)
    ) {
      throw new ForbiddenException('Missing MANAGE_ROLES permission');
    }

    // Enforce role hierarchy: actor's highest role must be above the assigned role
    await this.assertRoleHierarchy(actorId, guildId, role.position);

    const member = await this.prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: memberId } },
    });
    if (!member) throw new NotFoundException('Member not found');

    if (member.roles.includes(roleId)) {
      return member;
    }

    const updated = await this.prisma.guildMember.update({
      where: { guildId_userId: { guildId, userId: memberId } },
      data: { roles: { push: roleId } },
    });

    await this.prisma.auditLog.create({
      data: {
        guildId,
        actorId,
        targetId: memberId,
        targetType: 'USER',
        action: 'MEMBER_ROLE_UPDATE',
        changes: { added: [roleId] } as Prisma.InputJsonValue,
      },
    });

    return updated;
  }

  async removeMemberRole(guildId: string, memberId: string, roleId: string, actorId: string) {
    const role = await this.prisma.role.findFirst({ where: { id: roleId, guildId } });
    if (!role) throw new NotFoundException('Role not found');

    const perms = await this.permissionsService.computePermissionsForUser(actorId, guildId);
    if (
      !this.permissionsService.isAdministrator(perms) &&
      !this.permissionsService.hasPermission(perms, Permissions.MANAGE_ROLES)
    ) {
      throw new ForbiddenException('Missing MANAGE_ROLES permission');
    }

    // Enforce role hierarchy: actor's highest role must be above the removed role
    await this.assertRoleHierarchy(actorId, guildId, role.position);

    const member = await this.prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: memberId } },
    });
    if (!member) throw new NotFoundException('Member not found');

    const updated = await this.prisma.guildMember.update({
      where: { guildId_userId: { guildId, userId: memberId } },
      data: { roles: member.roles.filter((r: string) => r !== roleId) },
    });

    await this.prisma.auditLog.create({
      data: {
        guildId,
        actorId,
        targetId: memberId,
        targetType: 'USER',
        action: 'MEMBER_ROLE_UPDATE',
        changes: { removed: [roleId] } as Prisma.InputJsonValue,
      },
    });

    return updated;
  }

  async getSelfAssignableRoles(guildId: string) {
    const roles = await this.prisma.role.findMany({
      where: { guildId, selfAssignable: true },
      orderBy: { position: 'asc' },
    });
    return roles.map((r) => this.serializeRole(r));
  }

  async selfAssignRole(guildId: string, userId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({ where: { id: roleId, guildId } });
    if (!role) throw new NotFoundException('Role not found');
    if (!role.selfAssignable) throw new ForbiddenException('This role is not self-assignable');

    const member = await this.prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });
    if (!member) throw new NotFoundException('Member not found');
    if (member.roles.includes(roleId)) return;

    await this.prisma.guildMember.update({
      where: { guildId_userId: { guildId, userId } },
      data: { roles: { push: roleId } },
    });
  }

  async selfRemoveRole(guildId: string, userId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({ where: { id: roleId, guildId } });
    if (!role) throw new NotFoundException('Role not found');
    if (!role.selfAssignable) throw new ForbiddenException('This role is not self-assignable');

    const member = await this.prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });
    if (!member) throw new NotFoundException('Member not found');

    await this.prisma.guildMember.update({
      where: { guildId_userId: { guildId, userId } },
      data: { roles: member.roles.filter((r: string) => r !== roleId) },
    });
  }

  async getRoles(guildId: string) {
    const roles = await this.prisma.role.findMany({
      where: { guildId },
      orderBy: { position: 'asc' },
    });
    return roles.map((r) => this.serializeRole(r));
  }

  async computePermissions(userId: string, guildId: string, channelId?: string): Promise<string> {
    const perms = await this.permissionsService.computePermissionsForUser(
      userId,
      guildId,
      channelId,
    );
    return perms.toString();
  }
}
