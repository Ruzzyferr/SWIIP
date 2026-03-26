import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { OnEvent } from '@nestjs/event-emitter';
import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNotificationDto {
  @ApiProperty() @IsString() userId: string;
  @ApiProperty() @IsString() type: string;
  @ApiProperty() @IsString() title: string;
  @ApiProperty() @IsString() body: string;
  @ApiPropertyOptional() @IsOptional() @IsString() iconUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() targetUrl?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async create(dto: CreateNotificationDto) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        iconUrl: dto.iconUrl,
        targetUrl: dto.targetUrl,
      },
    });

    await this.redis.publish(
      `notifications:${dto.userId}`,
      JSON.stringify({ type: 'NOTIFICATION', data: notification }),
    );

    return notification;
  }

  async getNotifications(userId: string, options: { unreadOnly?: boolean; limit?: number; offset?: number } = {}) {
    const limit = Math.min(options.limit ?? 50, 100);

    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(options.unreadOnly && { read: false }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: options.offset ?? 0,
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true },
    });
    return { message: 'Marked as read' };
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return { message: 'All notifications marked as read' };
  }

  async deleteNotification(notificationId: string, userId: string) {
    await this.prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });
    return { message: 'Notification deleted' };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, read: false },
    });
  }

  @OnEvent('message.created')
  async handleMessageCreated(payload: { channelId: string; guildId?: string; message: any }) {
    if (!payload.message?.content?.includes('@')) return;
  }

  @OnEvent('user.registered')
  async handleUserRegistered(payload: { userId: string; email: string; username: string }) {
    await this.create({
      userId: payload.userId,
      type: 'WELCOME',
      title: 'Welcome to ConstChat!',
      body: `Hey ${payload.username}, welcome aboard! Explore guilds and connect with others.`,
    });
  }
}
