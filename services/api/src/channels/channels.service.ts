import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PermissionsService, Permissions } from '../permissions/permissions.service';
import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsEnum,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// ChannelType enum matches the Prisma schema; defined locally until prisma generate is run.
type ChannelType = 'TEXT' | 'VOICE' | 'CATEGORY' | 'DM' | 'GROUP_DM' | 'ANNOUNCEMENT' | 'STAGE' | 'FORUM' | 'THREAD';
const ChannelType: Record<ChannelType, ChannelType> = {
  TEXT: 'TEXT', VOICE: 'VOICE', CATEGORY: 'CATEGORY', DM: 'DM',
  GROUP_DM: 'GROUP_DM', ANNOUNCEMENT: 'ANNOUNCEMENT', STAGE: 'STAGE', FORUM: 'FORUM', THREAD: 'THREAD',
};
import { nanoid } from 'nanoid';
import { Prisma } from '@prisma/client';
import type { Channel } from '@prisma/client';

export class CreateChannelDto {
  @ApiProperty() @IsString() @MaxLength(100) name: string;
  @ApiProperty({ enum: ChannelType }) @IsEnum(ChannelType) type: ChannelType;
  @ApiPropertyOptional() @IsOptional() @IsString() parentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1024) topic?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isNsfw?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(21600) slowmode?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(99) userLimit?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() bitrate?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() position?: number;
}

export class UpdateChannelDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1024) topic?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isNsfw?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(21600) slowmode?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(99) userLimit?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() bitrate?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() position?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() parentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() rtcRegion?: string;
}

export class CreateChannelInviteDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) maxAge?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) maxUses?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() temporary?: boolean;
}

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly eventEmitter: EventEmitter2,
    private readonly permissionsService: PermissionsService,
  ) {}

  async create(guildId: string, actorId: string, dto: CreateChannelDto) {
    const perms = await this.permissionsService.computePermissionsForUser(actorId, guildId);
    if (
      !this.permissionsService.isAdministrator(perms) &&
      !this.permissionsService.hasPermission(perms, Permissions.MANAGE_CHANNELS)
    ) {
      throw new ForbiddenException('Missing MANAGE_CHANNELS permission');
    }

    const channel = await this.prisma.channel.create({
      data: {
        guildId,
        name: dto.name.toLowerCase().replace(/\s+/g, '-'),
        type: dto.type,
        parentId: dto.parentId,
        topic: dto.topic,
        isNsfw: dto.isNsfw ?? false,
        slowmode: dto.slowmode ?? 0,
        userLimit: dto.userLimit ?? 0,
        bitrate: dto.bitrate ?? 64000,
        position: dto.position ?? 0,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        guildId,
        actorId,
        targetId: channel.id,
        targetType: 'CHANNEL',
        action: 'CHANNEL_CREATE',
      },
    });

    this.eventEmitter.emit('channel.created', { guildId, channelId: channel.id, actorId });
    return channel;
  }

  async update(channelId: string, actorId: string, dto: UpdateChannelDto) {
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) throw new NotFoundException('Channel not found');

    if (channel.guildId) {
      const perms = await this.permissionsService.computePermissionsForUser(
        actorId,
        channel.guildId,
      );
      if (
        !this.permissionsService.isAdministrator(perms) &&
        !this.permissionsService.hasPermission(perms, Permissions.MANAGE_CHANNELS)
      ) {
        throw new ForbiddenException('Missing MANAGE_CHANNELS permission');
      }
    }

    const updated = await this.prisma.channel.update({
      where: { id: channelId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.topic !== undefined && { topic: dto.topic }),
        ...(dto.isNsfw !== undefined && { isNsfw: dto.isNsfw }),
        ...(dto.slowmode !== undefined && { slowmode: dto.slowmode }),
        ...(dto.userLimit !== undefined && { userLimit: dto.userLimit }),
        ...(dto.bitrate !== undefined && { bitrate: dto.bitrate }),
        ...(dto.position !== undefined && { position: dto.position }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
        ...(dto.rtcRegion !== undefined && { rtcRegion: dto.rtcRegion }),
      },
    });

    if (channel.guildId) {
      await this.prisma.auditLog.create({
        data: {
          guildId: channel.guildId,
          actorId,
          targetId: channelId,
          targetType: 'CHANNEL',
          action: 'CHANNEL_UPDATE',
          changes: dto as Prisma.InputJsonValue,
        },
      });
    }

    this.eventEmitter.emit('channel.updated', { channelId, actorId });
    return updated;
  }

  async delete(channelId: string, actorId: string) {
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) throw new NotFoundException('Channel not found');

    if (channel.guildId) {
      const perms = await this.permissionsService.computePermissionsForUser(
        actorId,
        channel.guildId,
      );
      if (
        !this.permissionsService.isAdministrator(perms) &&
        !this.permissionsService.hasPermission(perms, Permissions.MANAGE_CHANNELS)
      ) {
        throw new ForbiddenException('Missing MANAGE_CHANNELS permission');
      }
    }

    await this.prisma.channel.delete({ where: { id: channelId } });

    if (channel.guildId) {
      await this.prisma.auditLog.create({
        data: {
          guildId: channel.guildId,
          actorId,
          targetId: channelId,
          targetType: 'CHANNEL',
          action: 'CHANNEL_DELETE',
        },
      });
    }

    this.eventEmitter.emit('channel.deleted', { channelId, guildId: channel.guildId, actorId });
    return { message: 'Channel deleted' };
  }

  async reorder(guildId: string, actorId: string, positions: Array<{ id: string; position: number; parentId?: string }>) {
    const perms = await this.permissionsService.computePermissionsForUser(actorId, guildId);
    if (
      !this.permissionsService.isAdministrator(perms) &&
      !this.permissionsService.hasPermission(perms, Permissions.MANAGE_CHANNELS)
    ) {
      throw new ForbiddenException('Missing MANAGE_CHANNELS permission');
    }

    await this.prisma.$transaction(
      positions.map((p) =>
        this.prisma.channel.update({
          where: { id: p.id },
          data: {
            position: p.position,
            ...(p.parentId !== undefined && { parentId: p.parentId }),
          },
        }),
      ),
    );

    return { message: 'Channels reordered' };
  }

  async getChannel(channelId: string, userId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        permissionOverwriteRecords: true,
      },
    });

    if (!channel) throw new NotFoundException('Channel not found');

    if (channel.guildId) {
      const canView = await this.permissionsService.canViewChannel(userId, channelId);
      if (!canView) throw new ForbiddenException('Cannot view this channel');
    }

    return channel;
  }

  async getGuildChannels(guildId: string, userId: string) {
    const channels = await this.prisma.channel.findMany({
      where: { guildId },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });

    const visibleChannels = await Promise.all(
      channels.map(async (channel: Channel) => {
        const canView = await this.permissionsService.canViewChannel(userId, channel.id);
        return canView ? channel : null;
      }),
    );

    return visibleChannels.filter(Boolean);
  }

  async getPermissionOverwrites(channelId: string) {
    return this.prisma.permissionOverwrite.findMany({ where: { channelId } });
  }

  async updatePermissionOverwrite(
    channelId: string,
    actorId: string,
    targetId: string,
    targetType: 'ROLE' | 'MEMBER',
    allow: bigint,
    deny: bigint,
  ) {
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel || !channel.guildId) throw new NotFoundException('Channel not found');

    const perms = await this.permissionsService.computePermissionsForUser(
      actorId,
      channel.guildId,
    );
    if (
      !this.permissionsService.isAdministrator(perms) &&
      !this.permissionsService.hasPermission(perms, Permissions.MANAGE_CHANNELS)
    ) {
      throw new ForbiddenException('Missing MANAGE_CHANNELS permission');
    }

    const overwrite = await this.prisma.permissionOverwrite.upsert({
      where: {
        channelId_targetId_targetType: { channelId, targetId, targetType },
      },
      update: { allow, deny },
      create: { channelId, targetId, targetType, allow, deny },
    });

    await this.prisma.auditLog.create({
      data: {
        guildId: channel.guildId,
        actorId,
        targetId: channelId,
        targetType: 'CHANNEL',
        action: 'CHANNEL_OVERWRITE_UPDATE',
        changes: { targetId, targetType, allow: allow.toString(), deny: deny.toString() },
      },
    });

    return overwrite;
  }

  async deletePermissionOverwrite(channelId: string, actorId: string, targetId: string) {
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel || !channel.guildId) throw new NotFoundException('Channel not found');

    const perms = await this.permissionsService.computePermissionsForUser(
      actorId,
      channel.guildId,
    );
    if (
      !this.permissionsService.isAdministrator(perms) &&
      !this.permissionsService.hasPermission(perms, Permissions.MANAGE_CHANNELS)
    ) {
      throw new ForbiddenException('Missing MANAGE_CHANNELS permission');
    }

    await this.prisma.permissionOverwrite.deleteMany({
      where: { channelId, targetId },
    });

    return { message: 'Permission overwrite deleted' };
  }

  async createInvite(channelId: string, userId: string, dto: CreateChannelInviteDto) {
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel || !channel.guildId) throw new NotFoundException('Channel not found');

    const maxAge = dto.maxAge ?? 86400;
    const expiresAt = maxAge > 0 ? new Date(Date.now() + maxAge * 1000) : undefined;

    const invite = await this.prisma.invite.create({
      data: {
        code: nanoid(8),
        guildId: channel.guildId,
        channelId,
        inviterId: userId,
        maxAge,
        maxUses: dto.maxUses ?? 0,
        temporary: dto.temporary ?? false,
        expiresAt,
      },
      include: {
        inviter: {
          select: {
            id: true,
            username: true,
            discriminator: true,
            avatarId: true,
          },
        },
        channel: { select: { id: true, name: true, type: true } },
        guild: { select: { id: true, name: true, icon: true, memberCount: true } },
      },
    });

    return invite;
  }

  async getChannelInvites(channelId: string, _userId: string) {
    return this.prisma.invite.findMany({
      where: { channelId },
      include: {
        inviter: {
          select: {
            id: true,
            username: true,
            discriminator: true,
            avatarId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async triggerTyping(channelId: string, userId: string) {
    const canView = await this.permissionsService.canViewChannel(userId, channelId);
    if (!canView) throw new ForbiddenException('Cannot access this channel');

    await this.redis.publish(
      `channel:${channelId}:typing`,
      JSON.stringify({ userId, timestamp: Date.now() }),
    );

    return { message: 'Typing indicator sent' };
  }

  async getPins(channelId: string, userId: string) {
    const canView = await this.permissionsService.canViewChannel(userId, channelId);
    if (!canView) throw new ForbiddenException('Cannot access this channel');

    const pins = await this.prisma.pin.findMany({
      where: { channelId },
      include: {
        message: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
                discriminator: true,
                globalName: true,
                avatarId: true,
              },
            },
            attachments: true,
            reactions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return pins.map((p) => p.message);
  }

  async pinMessage(channelId: string, messageId: string, userId: string) {
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) throw new NotFoundException('Channel not found');

    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message || message.channelId !== channelId) {
      throw new NotFoundException('Message not found');
    }

    const pinCount = await this.prisma.pin.count({ where: { channelId } });
    if (pinCount >= 50) {
      throw new BadRequestException('Maximum of 50 pins per channel');
    }

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.pin.create({
        data: { messageId, channelId, pinnedById: userId },
      });
      await tx.message.update({
        where: { id: messageId },
        data: { pinned: true },
      });
      await tx.channel.update({
        where: { id: channelId },
        data: { lastPinAt: new Date() },
      });
    });

    if (channel.guildId) {
      await this.prisma.auditLog.create({
        data: {
          guildId: channel.guildId,
          actorId: userId,
          targetId: messageId,
          targetType: 'MESSAGE',
          action: 'MESSAGE_PIN',
        },
      });
    }

    return { message: 'Message pinned' };
  }

  async unpinMessage(channelId: string, messageId: string, userId: string) {
    const pin = await this.prisma.pin.findUnique({
      where: { messageId_channelId: { messageId, channelId } },
    });
    if (!pin) throw new NotFoundException('Pin not found');

    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.pin.delete({
        where: { messageId_channelId: { messageId, channelId } },
      });
      await tx.message.update({
        where: { id: messageId },
        data: { pinned: false },
      });
    });

    if (channel?.guildId) {
      await this.prisma.auditLog.create({
        data: {
          guildId: channel.guildId,
          actorId: userId,
          targetId: messageId,
          targetType: 'MESSAGE',
          action: 'MESSAGE_UNPIN',
        },
      });
    }

    return { message: 'Message unpinned' };
  }

  async acknowledgeChannel(channelId: string, userId: string, lastReadMessageId: string) {
    await this.prisma.readState.upsert({
      where: {
        userId_channelId: { userId, channelId },
      },
      update: {
        lastReadMessageId,
        mentionCount: 0,
      },
      create: {
        userId,
        channelId,
        lastReadMessageId,
        mentionCount: 0,
      },
    });
  }
}
