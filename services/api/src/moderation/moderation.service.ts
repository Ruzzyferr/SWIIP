import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PermissionsService, Permissions } from '../permissions/permissions.service';
// ModerationActionType enum matches the Prisma schema; defined locally until prisma generate is run.
type ModerationActionType = 'TIMEOUT' | 'KICK' | 'BAN' | 'SOFTBAN' | 'WARN' | 'MUTE';
const ModerationActionType: Record<ModerationActionType, ModerationActionType> = {
  TIMEOUT: 'TIMEOUT', KICK: 'KICK', BAN: 'BAN', SOFTBAN: 'SOFTBAN', WARN: 'WARN', MUTE: 'MUTE',
};
import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateModerationActionDto {
  @ApiProperty({ enum: ModerationActionType }) @IsEnum(ModerationActionType) type: ModerationActionType;
  @ApiProperty() @IsString() targetId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
  @ApiPropertyOptional({ description: 'ISO datetime for TIMEOUT expiry' }) @IsOptional() @IsString() expiresAt?: string;
}

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly permissionsService: PermissionsService,
  ) {}

  async createAction(guildId: string, actorId: string, dto: CreateModerationActionDto) {
    const perms = await this.permissionsService.computePermissionsForUser(actorId, guildId);

    const canModerate = this.permissionsService.isAdministrator(perms) ||
      this.permissionsService.hasPermission(perms, Permissions.MODERATE_MEMBERS) ||
      this.permissionsService.hasPermission(perms, Permissions.BAN_MEMBERS) ||
      this.permissionsService.hasPermission(perms, Permissions.KICK_MEMBERS);

    if (!canModerate) {
      throw new ForbiddenException('Insufficient permissions to moderate members');
    }

    const action = await this.prisma.moderationAction.create({
      data: {
        guildId,
        actorId,
        targetId: dto.targetId,
        type: dto.type,
        reason: dto.reason,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        active: true,
      },
      include: {
        target: {
          select: {
            id: true,
            username: true,
            discriminator: true,
            globalName: true,
            avatarId: true,
          },
        },
        actor: {
          select: {
            id: true,
            username: true,
            discriminator: true,
          },
        },
      },
    });

    if (dto.type === 'TIMEOUT' && dto.expiresAt) {
      await this.prisma.guildMember.updateMany({
        where: { guildId, userId: dto.targetId },
        data: { timeoutUntil: new Date(dto.expiresAt) },
      });
    }

    this.eventEmitter.emit('moderation.action', {
      guildId,
      actorId,
      targetId: dto.targetId,
      type: dto.type,
      actionId: action.id,
    });

    this.logger.log(`Moderation action ${dto.type} on ${dto.targetId} in guild ${guildId}`);
    return action;
  }

  async getActions(
    guildId: string,
    filters: {
      targetId?: string;
      actorId?: string;
      type?: ModerationActionType;
      active?: boolean;
      limit?: number;
      offset?: number;
    } = {},
  ) {
    const limit = Math.min(filters.limit ?? 50, 200);

    return this.prisma.moderationAction.findMany({
      where: {
        guildId,
        ...(filters.targetId && { targetId: filters.targetId }),
        ...(filters.actorId && { actorId: filters.actorId }),
        ...(filters.type && { type: filters.type }),
        ...(filters.active !== undefined && { active: filters.active }),
      },
      include: {
        target: {
          select: {
            id: true,
            username: true,
            discriminator: true,
            globalName: true,
            avatarId: true,
          },
        },
        actor: {
          select: {
            id: true,
            username: true,
            discriminator: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: filters.offset ?? 0,
    });
  }

  async revokeAction(actionId: string, guildId: string, actorId: string) {
    const action = await this.prisma.moderationAction.findFirst({
      where: { id: actionId, guildId },
    });

    if (!action) throw new NotFoundException('Moderation action not found');

    await this.prisma.moderationAction.update({
      where: { id: actionId },
      data: { active: false },
    });

    if (action.type === 'TIMEOUT') {
      await this.prisma.guildMember.updateMany({
        where: { guildId, userId: action.targetId },
        data: { timeoutUntil: null },
      });
    }

    return { message: 'Action revoked' };
  }

  async getAuditLog(
    guildId: string,
    filters: {
      actorId?: string;
      action?: string;
      limit?: number;
      before?: string;
    } = {},
  ) {
    const limit = Math.min(filters.limit ?? 50, 100);

    return this.prisma.auditLog.findMany({
      where: {
        guildId,
        ...(filters.actorId && { actorId: filters.actorId }),
        ...(filters.action && { action: filters.action as any }),
        ...(filters.before && { id: { lt: filters.before } }),
      },
      include: {
        actor: {
          select: {
            id: true,
            username: true,
            discriminator: true,
            globalName: true,
            avatarId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async createAutomodRule(
    guildId: string,
    actorId: string,
    dto: {
      name: string;
      triggerType: string;
      triggerMetadata: object;
      actions: object;
      exemptRoles?: string[];
      exemptChannels?: string[];
    },
  ) {
    const perms = await this.permissionsService.computePermissionsForUser(actorId, guildId);
    if (!this.permissionsService.isAdministrator(perms)) {
      throw new ForbiddenException('Only administrators can manage automod rules');
    }

    const rule = await this.prisma.automodRule.create({
      data: {
        guildId,
        name: dto.name,
        triggerType: dto.triggerType as any,
        triggerMetadata: dto.triggerMetadata,
        actions: dto.actions,
        exemptRoles: dto.exemptRoles ?? [],
        exemptChannels: dto.exemptChannels ?? [],
      },
    });

    await this.prisma.auditLog.create({
      data: {
        guildId,
        actorId,
        targetId: rule.id,
        targetType: 'AUTOMOD_RULE',
        action: 'AUTOMOD_RULE_CREATE',
      },
    });

    return rule;
  }

  async getAutomodRules(guildId: string) {
    return this.prisma.automodRule.findMany({
      where: { guildId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateAutomodRule(ruleId: string, guildId: string, actorId: string, dto: any) {
    const rule = await this.prisma.automodRule.findFirst({ where: { id: ruleId, guildId } });
    if (!rule) throw new NotFoundException('Automod rule not found');

    const perms = await this.permissionsService.computePermissionsForUser(actorId, guildId);
    if (!this.permissionsService.isAdministrator(perms)) {
      throw new ForbiddenException('Only administrators can manage automod rules');
    }

    return this.prisma.automodRule.update({
      where: { id: ruleId },
      data: dto,
    });
  }

  async deleteAutomodRule(ruleId: string, guildId: string, actorId: string) {
    const rule = await this.prisma.automodRule.findFirst({ where: { id: ruleId, guildId } });
    if (!rule) throw new NotFoundException('Automod rule not found');

    const perms = await this.permissionsService.computePermissionsForUser(actorId, guildId);
    if (!this.permissionsService.isAdministrator(perms)) {
      throw new ForbiddenException('Only administrators can manage automod rules');
    }

    await this.prisma.automodRule.delete({ where: { id: ruleId } });
    return { message: 'Automod rule deleted' };
  }
}
