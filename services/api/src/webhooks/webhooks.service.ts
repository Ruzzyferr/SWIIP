import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PermissionsService, Permissions } from '../permissions/permissions.service';
import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// WebhookType enum matches the Prisma schema; defined locally until prisma generate is run.
type WebhookType = 'INCOMING' | 'CHANNEL_FOLLOWER';
const WebhookType: Record<WebhookType, WebhookType> = {
  INCOMING: 'INCOMING', CHANNEL_FOLLOWER: 'CHANNEL_FOLLOWER',
};
import { nanoid } from 'nanoid';

export class CreateWebhookDto {
  @ApiProperty() @IsString() @MaxLength(80) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() avatarId?: string;
}

export class UpdateWebhookDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() avatarId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() channelId?: string;
}

export class ExecuteWebhookDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) content?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() username?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() avatarUrl?: string;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly permissionsService: PermissionsService,
  ) {}

  async create(channelId: string, guildId: string, actorId: string, dto: CreateWebhookDto) {
    const perms = await this.permissionsService.computePermissionsForUser(actorId, guildId);
    if (
      !this.permissionsService.isAdministrator(perms) &&
      !this.permissionsService.hasPermission(perms, Permissions.MANAGE_WEBHOOKS)
    ) {
      throw new ForbiddenException('Missing MANAGE_WEBHOOKS permission');
    }

    const webhook = await this.prisma.webhook.create({
      data: {
        guildId,
        channelId,
        name: dto.name,
        token: nanoid(64),
        avatarId: dto.avatarId,
        type: 'INCOMING',
        createdById: actorId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        guildId,
        actorId,
        targetId: webhook.id,
        targetType: 'WEBHOOK',
        action: 'WEBHOOK_CREATE',
      },
    });

    this.logger.log(`Webhook created: ${webhook.id} in channel ${channelId}`);
    return webhook;
  }

  async getGuildWebhooks(guildId: string, actorId: string) {
    const perms = await this.permissionsService.computePermissionsForUser(actorId, guildId);
    if (
      !this.permissionsService.isAdministrator(perms) &&
      !this.permissionsService.hasPermission(perms, Permissions.MANAGE_WEBHOOKS)
    ) {
      throw new ForbiddenException('Missing MANAGE_WEBHOOKS permission');
    }

    return this.prisma.webhook.findMany({
      where: { guildId },
      select: {
        id: true,
        name: true,
        channelId: true,
        guildId: true,
        avatarId: true,
        type: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
        // Never expose the token in listings
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getChannelWebhooks(channelId: string, actorId: string) {
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel || !channel.guildId) throw new NotFoundException('Channel not found');

    const perms = await this.permissionsService.computePermissionsForUser(
      actorId,
      channel.guildId,
    );
    if (
      !this.permissionsService.isAdministrator(perms) &&
      !this.permissionsService.hasPermission(perms, Permissions.MANAGE_WEBHOOKS)
    ) {
      throw new ForbiddenException('Missing MANAGE_WEBHOOKS permission');
    }

    return this.prisma.webhook.findMany({
      where: { channelId },
      select: {
        id: true,
        name: true,
        channelId: true,
        guildId: true,
        avatarId: true,
        type: true,
        createdById: true,
        createdAt: true,
      },
    });
  }

  async getWebhook(webhookId: string, actorId?: string) {
    const webhook = await this.prisma.webhook.findUnique({
      where: { id: webhookId },
      select: {
        id: true,
        name: true,
        channelId: true,
        guildId: true,
        avatarId: true,
        type: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!webhook) throw new NotFoundException('Webhook not found');
    return webhook;
  }

  async update(webhookId: string, actorId: string, dto: UpdateWebhookDto) {
    const webhook = await this.prisma.webhook.findUnique({ where: { id: webhookId } });
    if (!webhook) throw new NotFoundException('Webhook not found');

    const perms = await this.permissionsService.computePermissionsForUser(
      actorId,
      webhook.guildId,
    );
    if (
      !this.permissionsService.isAdministrator(perms) &&
      !this.permissionsService.hasPermission(perms, Permissions.MANAGE_WEBHOOKS)
    ) {
      throw new ForbiddenException('Missing MANAGE_WEBHOOKS permission');
    }

    // Prevent moving webhook to a channel in a different guild
    if (dto.channelId) {
      const targetChannel = await this.prisma.channel.findUnique({
        where: { id: dto.channelId },
        select: { guildId: true },
      });
      if (!targetChannel || targetChannel.guildId !== webhook.guildId) {
        throw new ForbiddenException(
          'Target channel must belong to the same guild as the webhook',
        );
      }
    }

    const updated = await this.prisma.webhook.update({
      where: { id: webhookId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.avatarId !== undefined && { avatarId: dto.avatarId }),
        ...(dto.channelId && { channelId: dto.channelId }),
      },
      select: {
        id: true,
        name: true,
        channelId: true,
        guildId: true,
        avatarId: true,
        updatedAt: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        guildId: webhook.guildId,
        actorId,
        targetId: webhookId,
        targetType: 'WEBHOOK',
        action: 'WEBHOOK_UPDATE',
        changes: dto as any,
      },
    });

    return updated;
  }

  async delete(webhookId: string, actorId: string) {
    const webhook = await this.prisma.webhook.findUnique({ where: { id: webhookId } });
    if (!webhook) throw new NotFoundException('Webhook not found');

    const perms = await this.permissionsService.computePermissionsForUser(
      actorId,
      webhook.guildId,
    );
    if (
      !this.permissionsService.isAdministrator(perms) &&
      !this.permissionsService.hasPermission(perms, Permissions.MANAGE_WEBHOOKS)
    ) {
      throw new ForbiddenException('Missing MANAGE_WEBHOOKS permission');
    }

    await this.prisma.webhook.delete({ where: { id: webhookId } });

    await this.prisma.auditLog.create({
      data: {
        guildId: webhook.guildId,
        actorId,
        targetId: webhookId,
        targetType: 'WEBHOOK',
        action: 'WEBHOOK_DELETE',
      },
    });

    return { message: 'Webhook deleted' };
  }

  async execute(webhookId: string, token: string, dto: ExecuteWebhookDto) {
    const webhook = await this.prisma.webhook.findUnique({
      where: { id: webhookId },
      select: {
        id: true,
        token: true,
        channelId: true,
        guildId: true,
        name: true,
        avatarId: true,
        createdById: true,
      },
    });

    if (!webhook) {
      throw new ForbiddenException('Invalid webhook token');
    }

    const tokenBuffer = Buffer.from(token);
    const webhookTokenBuffer = Buffer.from(webhook.token);
    if (
      tokenBuffer.length !== webhookTokenBuffer.length ||
      !timingSafeEqual(tokenBuffer, webhookTokenBuffer)
    ) {
      throw new ForbiddenException('Invalid webhook token');
    }

    if (!dto.content) {
      return { message: 'Message sent' };
    }

    const message = await this.prisma.message.create({
      data: {
        channelId: webhook.channelId,
        guildId: webhook.guildId,
        authorId: webhook.createdById ?? webhook.id,
        content: dto.content,
        webhookId: webhook.id,
        type: 'DEFAULT',
      },
    });

    this.eventEmitter.emit('webhook.executed', {
      webhookId,
      channelId: webhook.channelId,
      messageId: message.id,
    });

    return message;
  }
}
