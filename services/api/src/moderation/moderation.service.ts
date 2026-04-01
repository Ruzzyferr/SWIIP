import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PermissionsService, Permissions } from '../permissions/permissions.service';
import {
  ModerationActionType,
  AutomodTriggerType,
  AuditLogAction,
  Prisma,
} from '@prisma/client';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateModerationActionDto {
  @ApiProperty({ enum: ModerationActionType }) @IsEnum(ModerationActionType) type!: ModerationActionType;
  @ApiProperty() @IsString() targetId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
  @ApiPropertyOptional({ description: 'ISO datetime for TIMEOUT expiry' }) @IsOptional() @IsString() expiresAt?: string;
}

export class CreateAutomodRuleDto {
  @ApiProperty() @IsString() name!: string;
  @ApiProperty({ enum: AutomodTriggerType }) @IsEnum(AutomodTriggerType) triggerType!: AutomodTriggerType;
  @ApiProperty() @IsObject() triggerMetadata!: Record<string, unknown>;
  @ApiProperty() @IsObject() actions!: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) exemptRoles?: string[];
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) exemptChannels?: string[];
}

export class UpdateAutomodRuleDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional({ enum: AutomodTriggerType }) @IsOptional() @IsEnum(AutomodTriggerType) triggerType?: AutomodTriggerType;
  @ApiPropertyOptional() @IsOptional() @IsObject() triggerMetadata?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsObject() actions?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) exemptRoles?: string[];
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) exemptChannels?: string[];
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

  async revokeAction(actionId: string, guildId: string, _actorId: string) {
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

    const auditAction =
      filters.action &&
      (Object.values(AuditLogAction) as string[]).includes(filters.action)
        ? (filters.action as AuditLogAction)
        : undefined;

    return this.prisma.auditLog.findMany({
      where: {
        guildId,
        ...(filters.actorId && { actorId: filters.actorId }),
        ...(auditAction && { action: auditAction }),
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

  async createAutomodRule(guildId: string, actorId: string, dto: CreateAutomodRuleDto) {
    const perms = await this.permissionsService.computePermissionsForUser(actorId, guildId);
    if (!this.permissionsService.isAdministrator(perms)) {
      throw new ForbiddenException('Only administrators can manage automod rules');
    }

    const rule = await this.prisma.automodRule.create({
      data: {
        guildId,
        name: dto.name,
        triggerType: dto.triggerType,
        triggerMetadata: dto.triggerMetadata as Prisma.InputJsonValue,
        actions: dto.actions as Prisma.InputJsonValue,
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

  async updateAutomodRule(ruleId: string, guildId: string, actorId: string, dto: UpdateAutomodRuleDto) {
    const rule = await this.prisma.automodRule.findFirst({ where: { id: ruleId, guildId } });
    if (!rule) throw new NotFoundException('Automod rule not found');

    const perms = await this.permissionsService.computePermissionsForUser(actorId, guildId);
    if (!this.permissionsService.isAdministrator(perms)) {
      throw new ForbiddenException('Only administrators can manage automod rules');
    }

    const data: Prisma.AutomodRuleUpdateInput = {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.triggerType !== undefined && { triggerType: dto.triggerType }),
      ...(dto.triggerMetadata !== undefined && {
        triggerMetadata: dto.triggerMetadata as Prisma.InputJsonValue,
      }),
      ...(dto.actions !== undefined && { actions: dto.actions as Prisma.InputJsonValue }),
      ...(dto.exemptRoles !== undefined && { exemptRoles: dto.exemptRoles }),
      ...(dto.exemptChannels !== undefined && { exemptChannels: dto.exemptChannels }),
    };

    return this.prisma.automodRule.update({
      where: { id: ruleId },
      data,
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
