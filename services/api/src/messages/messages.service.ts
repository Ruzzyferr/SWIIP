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
import { SearchService } from '../search/search.service';
import {
  IsString,
  IsOptional,
  MaxLength,
  IsArray,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMessageDto {
  @ApiProperty({ maxLength: 4000 })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referencedMessageId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nonce?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentIds?: string[];
}

export class UpdateMessageDto {
  @ApiProperty({ maxLength: 4000 })
  @IsString()
  @MaxLength(4000)
  content: string;
}

export class GetMessagesDto {
  @ApiPropertyOptional() @IsOptional() @IsString() before?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() after?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() around?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly eventEmitter: EventEmitter2,
    private readonly permissionsService: PermissionsService,
    private readonly searchService: SearchService,
  ) {}

  private readonly MESSAGE_INCLUDE = {
    author: {
      select: {
        id: true,
        username: true,
        discriminator: true,
        globalName: true,
        avatarId: true,
        flags: true,
        isBot: true,
      },
    },
    attachments: true,
    reactions: {
      select: {
        emojiId: true,
        emojiName: true,
        emojiAnimated: true,
        userId: true,
      },
    },
    referencedMessage: {
      select: {
        id: true,
        content: true,
        author: {
          select: {
            id: true,
            username: true,
            globalName: true,
            avatarId: true,
          },
        },
      },
    },
  };

  async create(channelId: string, userId: string, dto: CreateMessageDto) {
    if (!dto.content?.trim() && (!dto.attachmentIds || dto.attachmentIds.length === 0)) {
      throw new BadRequestException('Message must have content or attachments');
    }

    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) throw new NotFoundException('Channel not found');

    if (channel.guildId) {
      const perms = await this.permissionsService.computePermissionsForUser(
        userId,
        channel.guildId,
        channelId,
      );
      if (!this.permissionsService.hasPermission(perms, Permissions.SEND_MESSAGES)) {
        throw new ForbiddenException('Missing SEND_MESSAGES permission');
      }
    }

    // Check slowmode
    const slowmodeKey = channel.slowmode > 0 ? `slowmode:${channelId}:${userId}` : null;
    if (slowmodeKey) {
      const lastMessage = await this.redis.get(slowmodeKey);
      if (lastMessage) {
        throw new BadRequestException(
          `Slowmode active. Wait ${channel.slowmode} seconds between messages.`,
        );
      }
    }

    const message = await this.prisma.message.create({
      data: {
        channelId,
        guildId: channel.guildId,
        authorId: userId,
        content: dto.content ?? '',
        referencedMessageId: dto.referencedMessageId,
        nonce: dto.nonce,
        type: dto.referencedMessageId ? 'REPLY' : 'DEFAULT',
      },
      include: this.MESSAGE_INCLUDE,
    });

    // Set slowmode AFTER successful message creation (not before, to avoid
    // rate-limiting the user if the DB write fails)
    if (slowmodeKey) {
      await this.redis.setex(slowmodeKey, channel.slowmode, '1');
    }

    // Link pending attachments to this message
    if (dto.attachmentIds && dto.attachmentIds.length > 0) {
      await this.prisma.attachment.updateMany({
        where: {
          id: { in: dto.attachmentIds },
          uploaderId: userId,
          messageId: null,
        },
        data: { messageId: message.id },
      });

      // Re-fetch message with linked attachments
      const updated = await this.prisma.message.findUnique({
        where: { id: message.id },
        include: this.MESSAGE_INCLUDE,
      });
      if (updated) {
        await this.prisma.channel.update({
          where: { id: channelId },
          data: { lastMessageId: message.id },
        });

        await this.redis.publish(
          `channel:${channelId}:messages`,
          JSON.stringify({ type: 'MESSAGE_CREATE', data: updated }),
        );

        this.eventEmitter.emit('message.created', {
          channelId,
          guildId: channel.guildId,
          message: updated,
        });

        // Index for search (fire and forget)
        this.searchService.indexMessage({
          id: updated.id,
          channelId,
          guildId: channel.guildId ?? undefined,
          authorId: userId,
          authorUsername: updated.author?.username ?? userId,
          content: updated.content,
          timestamp: updated.createdAt,
        }).catch((err) => this.logger.warn({ err }, 'Failed to index message for search'));

        return updated;
      }
    }

    await this.prisma.channel.update({
      where: { id: channelId },
      data: { lastMessageId: message.id },
    });

    await this.redis.publish(
      `channel:${channelId}:messages`,
      JSON.stringify({ type: 'MESSAGE_CREATE', data: message }),
    );

    this.eventEmitter.emit('message.created', {
      channelId,
      guildId: channel.guildId,
      message,
    });

    // Index for search (fire and forget)
    this.searchService.indexMessage({
      id: message.id,
      channelId,
      guildId: channel.guildId ?? undefined,
      authorId: userId,
      authorUsername: message.author?.username ?? userId,
      content: message.content,
      timestamp: message.createdAt,
    }).catch((err) => this.logger.warn({ err }, 'Failed to index message for search'));

    return message;
  }

  async getMessages(channelId: string, userId: string, options: GetMessagesDto = {}) {
    const canView = await this.permissionsService.canViewChannel(userId, channelId);
    if (!canView) throw new ForbiddenException('Cannot view this channel');

    const limit = Math.min(options.limit ?? 50, 100);
    const where: any = { channelId, deletedAt: null };

    if (options.before) {
      where.id = { lt: options.before };
    } else if (options.after) {
      where.id = { gt: options.after };
    } else if (options.around) {
      const aroundMessage = await this.prisma.message.findUnique({
        where: { id: options.around },
      });
      if (aroundMessage) {
        where.createdAt = {
          gte: new Date(aroundMessage.createdAt.getTime() - 1000 * 60 * 60),
          lte: new Date(aroundMessage.createdAt.getTime() + 1000 * 60 * 60),
        };
      }
    }

    const messages = await this.prisma.message.findMany({
      where,
      include: this.MESSAGE_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return messages.reverse();
  }

  async getMessage(messageId: string, channelId: string, userId: string) {
    const canView = await this.permissionsService.canViewChannel(userId, channelId);
    if (!canView) throw new ForbiddenException('Cannot view this channel');

    const message = await this.prisma.message.findFirst({
      where: { id: messageId, channelId, deletedAt: null },
      include: this.MESSAGE_INCLUDE,
    });

    if (!message) throw new NotFoundException('Message not found');
    return message;
  }

  async update(messageId: string, userId: string, dto: UpdateMessageDto) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Message not found');
    if (message.authorId !== userId) {
      throw new ForbiddenException('Cannot edit another user\'s message');
    }
    if (message.deletedAt) throw new NotFoundException('Message not found');

    const [updated] = await this.prisma.$transaction([
      this.prisma.message.update({
        where: { id: messageId },
        data: { content: dto.content, editedAt: new Date() },
        include: this.MESSAGE_INCLUDE,
      }),
      this.prisma.messageRevision.create({
        data: {
          messageId,
          content: message.content,
          editedAt: new Date(),
        },
      }),
    ]);

    await this.redis.publish(
      `channel:${message.channelId}:messages`,
      JSON.stringify({ type: 'MESSAGE_UPDATE', data: updated }),
    );

    this.eventEmitter.emit('message.updated', { messageId, channelId: message.channelId });

    // Update search index (fire and forget)
    this.searchService.updateMessageIndex(messageId, dto.content)
      .catch((err) => this.logger.warn({ err }, 'Failed to update message search index'));

    return updated;
  }

  async delete(messageId: string, userId: string, actorId?: string) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message || message.deletedAt) throw new NotFoundException('Message not found');

    const isAuthor = message.authorId === userId;
    const channel = await this.prisma.channel.findUnique({
      where: { id: message.channelId },
    });

    if (!isAuthor && channel?.guildId) {
      const perms = await this.permissionsService.computePermissionsForUser(
        actorId ?? userId,
        channel.guildId,
        message.channelId,
      );
      if (!this.permissionsService.hasPermission(perms, Permissions.MANAGE_MESSAGES)) {
        throw new ForbiddenException('Cannot delete this message');
      }
    } else if (!isAuthor) {
      throw new ForbiddenException('Cannot delete this message');
    }

    await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });

    await this.redis.publish(
      `channel:${message.channelId}:messages`,
      JSON.stringify({ type: 'MESSAGE_DELETE', data: { id: messageId, channelId: message.channelId } }),
    );

    this.eventEmitter.emit('message.deleted', { messageId, channelId: message.channelId });

    // Remove from search index (fire and forget)
    this.searchService.deleteMessageFromIndex(messageId)
      .catch((err) => this.logger.warn({ err }, 'Failed to delete message from search index'));

    return { message: 'Message deleted' };
  }

  async bulkDelete(channelId: string, actorId: string, messageIds: string[]) {
    if (messageIds.length === 0) throw new BadRequestException('No messages provided');
    if (messageIds.length > 100) throw new BadRequestException('Maximum 100 messages at once');

    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) throw new NotFoundException('Channel not found');

    if (channel.guildId) {
      const perms = await this.permissionsService.computePermissionsForUser(
        actorId,
        channel.guildId,
        channelId,
      );
      if (!this.permissionsService.hasPermission(perms, Permissions.MANAGE_MESSAGES)) {
        throw new ForbiddenException('Missing MANAGE_MESSAGES permission');
      }
    }

    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    await this.prisma.message.updateMany({
      where: {
        id: { in: messageIds },
        channelId,
        createdAt: { gte: twoWeeksAgo },
      },
      data: { deletedAt: new Date() },
    });

    if (channel.guildId) {
      await this.prisma.auditLog.create({
        data: {
          guildId: channel.guildId,
          actorId,
          targetId: channelId,
          targetType: 'CHANNEL',
          action: 'MESSAGE_BULK_DELETE',
          options: { count: messageIds.length } as any,
        },
      });
    }

    await this.redis.publish(
      `channel:${channelId}:messages`,
      JSON.stringify({ type: 'MESSAGE_DELETE_BULK', data: { ids: messageIds, channelId } }),
    );

    return { message: `${messageIds.length} messages deleted` };
  }

  async addReaction(messageId: string, channelId: string, userId: string, emoji: string) {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, channelId, deletedAt: null },
    });
    if (!message) throw new NotFoundException('Message not found');

    const canView = await this.permissionsService.canViewChannel(userId, channelId);
    if (!canView) throw new ForbiddenException('Cannot access this channel');

    const { emojiId, emojiName } = this.parseEmoji(emoji);

    const existingCount = await this.prisma.reaction.count({
      where: { messageId, emojiName, emojiId: emojiId ?? undefined },
    });

    if (existingCount >= 20) {
      throw new BadRequestException('Maximum 20 unique reactions per message per emoji');
    }

    const reaction = await this.prisma.reaction.upsert({
      where: {
        messageId_userId_emojiName_emojiId: {
          messageId,
          userId,
          emojiName,
          emojiId: emojiId ?? '',
        },
      },
      update: {},
      create: {
        messageId,
        channelId,
        userId,
        emojiId,
        emojiName,
        emojiAnimated: false,
      },
    });

    await this.redis.publish(
      `channel:${channelId}:messages`,
      JSON.stringify({ type: 'REACTION_ADD', data: { messageId, userId, emoji } }),
    );

    return reaction;
  }

  async removeReaction(messageId: string, channelId: string, userId: string, emoji: string) {
    const { emojiId, emojiName } = this.parseEmoji(emoji);

    await this.prisma.reaction.deleteMany({
      where: {
        messageId,
        userId,
        emojiName,
        ...(emojiId && { emojiId }),
      },
    });

    await this.redis.publish(
      `channel:${channelId}:messages`,
      JSON.stringify({ type: 'REACTION_REMOVE', data: { messageId, userId, emoji } }),
    );

    return { message: 'Reaction removed' };
  }

  async getReactions(messageId: string, emoji: string) {
    const { emojiId, emojiName } = this.parseEmoji(emoji);

    const reactions = await this.prisma.reaction.findMany({
      where: {
        messageId,
        emojiName,
        ...(emojiId && { emojiId }),
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            discriminator: true,
            globalName: true,
            avatarId: true,
          },
        },
      },
    });

    return reactions.map((r: any) => r.user);
  }

  async removeAllReactions(messageId: string, actorId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { channel: true },
    });
    if (!message) throw new NotFoundException('Message not found');

    if (message.channel.guildId) {
      const perms = await this.permissionsService.computePermissionsForUser(
        actorId,
        message.channel.guildId,
        message.channelId,
      );
      if (!this.permissionsService.hasPermission(perms, Permissions.MANAGE_MESSAGES)) {
        throw new ForbiddenException('Missing MANAGE_MESSAGES permission');
      }
    }

    await this.prisma.reaction.deleteMany({ where: { messageId } });

    await this.redis.publish(
      `channel:${message.channelId}:messages`,
      JSON.stringify({ type: 'REACTION_REMOVE_ALL', data: { messageId } }),
    );

    return { message: 'All reactions removed' };
  }

  async crosspost(messageId: string, channelId: string, userId: string) {
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) throw new NotFoundException('Channel not found');
    if (channel.type !== 'ANNOUNCEMENT') {
      throw new BadRequestException('Can only crosspost from announcement channels');
    }

    const message = await this.prisma.message.findFirst({
      where: { id: messageId, channelId, deletedAt: null },
    });
    if (!message) throw new NotFoundException('Message not found');

    this.eventEmitter.emit('message.crosspost', { messageId, channelId, userId });
    return { message: 'Message crossposted' };
  }

  private parseEmoji(emoji: string): { emojiId: string | null; emojiName: string } {
    const customEmojiMatch = emoji.match(/^<a?:(\w+):(\d+)>$/);
    if (customEmojiMatch) {
      return { emojiName: customEmojiMatch[1]!, emojiId: customEmojiMatch[2]! };
    }
    return { emojiName: emoji, emojiId: null };
  }
}
