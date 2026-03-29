import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  IsString,
  IsOptional,
  MaxLength,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32) globalName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(190) bio?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(16777215) accentColor?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() locale?: string;
}

export class SendFriendRequestDto {
  @IsString() username: string;
  @IsString() discriminator: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private readonly PUBLIC_SELECT = {
    id: true,
    username: true,
    discriminator: true,
    globalName: true,
    avatarId: true,
    bannerId: true,
    bio: true,
    accentColor: true,
    flags: true,
    isBot: true,
    verified: true,
    createdAt: true,
  };

  async findByIdPublic(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...this.PUBLIC_SELECT,
        presenceState: {
          select: {
            status: true,
            customStatusText: true,
            customStatusEmoji: true,
            lastSeenAt: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.mapUserFields(user);
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...this.PUBLIC_SELECT,
        email: true,
        locale: true,
        premiumType: true,
        mfaEnabled: true,
        updatedAt: true,
        presenceState: {
          select: {
            status: true,
            customStatusText: true,
            customStatusEmoji: true,
            lastSeenAt: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.mapUserFields(user);
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findByUsername(username: string, discriminator?: string) {
    if (discriminator) {
      return this.prisma.user.findUnique({
        where: { username_discriminator: { username, discriminator } },
        select: this.PUBLIC_SELECT,
      });
    }

    return this.prisma.user.findMany({
      where: { username: { contains: username, mode: 'insensitive' } },
      select: this.PUBLIC_SELECT,
      take: 25,
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.globalName !== undefined && { globalName: dto.globalName }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.accentColor !== undefined && { accentColor: dto.accentColor }),
        ...(dto.locale !== undefined && { locale: dto.locale }),
      },
      select: {
        id: true,
        username: true,
        discriminator: true,
        globalName: true,
        avatarId: true,
        bannerId: true,
        bio: true,
        accentColor: true,
        locale: true,
        flags: true,
        updatedAt: true,
      },
    });
    return this.mapUserFields(updated);
  }

  async updateAvatar(userId: string, avatarId: string) {
    const result = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarId },
      select: { id: true, avatarId: true },
    });
    return { id: result.id, avatar: result.avatarId };
  }

  async updateBanner(userId: string, bannerId: string) {
    const result = await this.prisma.user.update({
      where: { id: userId },
      data: { bannerId },
      select: { id: true, bannerId: true },
    });
    return { id: result.id, banner: result.bannerId };
  }

  private mapUserFields(user: any) {
    const { avatarId, bannerId, ...rest } = user;
    return {
      ...rest,
      avatar: avatarId ?? null,
      banner: bannerId ?? null,
    };
  }

  async getProfile(userId: string, requesterId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...this.PUBLIC_SELECT,
        presenceState: {
          select: {
            status: true,
            customStatusText: true,
            customStatusEmoji: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const relationship = await this.prisma.userRelationship.findFirst({
      where: {
        OR: [
          { requesterId, targetId: userId },
          { requesterId: userId, targetId: requesterId },
        ],
      },
      select: { type: true },
    });

    const mutualGuilds = await this.getMutualGuilds(requesterId, userId);

    return {
      user: this.mapUserFields(user),
      relationshipType: relationship?.type ?? null,
      mutualGuildCount: mutualGuilds.length,
    };
  }

  async getUserGuilds(userId: string) {
    const members = await this.prisma.guildMember.findMany({
      where: { userId },
      include: {
        guild: {
          select: {
            id: true,
            name: true,
            icon: true,
            ownerId: true,
            memberCount: true,
            boostTier: true,
            features: true,
          },
        },
      },
    });

    return members.map((m: any) => ({
      ...m.guild,
      nick: m.nick,
      roles: m.roles,
      isOwner: m.isOwner,
      joinedAt: m.joinedAt,
    }));
  }

  async getFriends(userId: string) {
    const relationships = await this.prisma.userRelationship.findMany({
      where: {
        OR: [
          { requesterId: userId, type: 'FRIEND' },
          { targetId: userId, type: 'FRIEND' },
        ],
      },
      include: {
        requester: { select: this.PUBLIC_SELECT },
        target: { select: this.PUBLIC_SELECT },
      },
    });

    return relationships.map((r: any) => {
      const friend = r.requesterId === userId ? r.target : r.requester;
      return this.mapUserFields(friend);
    });
  }

  async getRelationships(userId: string) {
    const sent = await this.prisma.userRelationship.findMany({
      where: { requesterId: userId },
      include: { target: { select: this.PUBLIC_SELECT } },
    });

    const received = await this.prisma.userRelationship.findMany({
      where: { targetId: userId },
      include: { requester: { select: this.PUBLIC_SELECT } },
    });

    return [
      ...sent.map((r: any) => ({
        id: r.id,
        type: r.type,
        user: this.mapUserFields(r.target),
        since: new Date().toISOString(),
      })),
      ...received.map((r: any) => ({
        id: r.id,
        type: r.type,
        user: this.mapUserFields(r.requester),
        since: new Date().toISOString(),
      })),
    ];
  }

  async sendFriendRequest(requesterId: string, targetUsername: string, discriminator: string) {
    const target = await this.prisma.user.findUnique({
      where: { username_discriminator: { username: targetUsername, discriminator } },
      select: { id: true, username: true, discriminator: true },
    });

    if (!target) throw new NotFoundException('User not found');
    if (target.id === requesterId) throw new BadRequestException('Cannot add yourself');

    const existing = await this.prisma.userRelationship.findFirst({
      where: {
        OR: [
          { requesterId, targetId: target.id },
          { requesterId: target.id, targetId: requesterId },
        ],
      },
    });

    if (existing) {
      if (existing.type === 'FRIEND') throw new ConflictException('Already friends');
      if (existing.type === 'BLOCKED') throw new ForbiddenException('Cannot send friend request');
      if (existing.type === 'PENDING_OUTGOING' && existing.requesterId === requesterId) {
        throw new ConflictException('Friend request already sent');
      }

      if (existing.type === 'PENDING_OUTGOING' && existing.requesterId === target.id) {
        return this.acceptFriendRequest(requesterId, target.id);
      }
    }

    // Check if blocked by target
    const blocked = await this.prisma.userRelationship.findFirst({
      where: { requesterId: target.id, targetId: requesterId, type: 'BLOCKED' },
    });
    if (blocked) throw new ForbiddenException('Cannot send friend request');

    await this.prisma.$transaction([
      this.prisma.userRelationship.create({
        data: { requesterId, targetId: target.id, type: 'PENDING_OUTGOING' },
      }),
      this.prisma.userRelationship.create({
        data: { requesterId: target.id, targetId: requesterId, type: 'PENDING_INCOMING' },
      }),
    ]);

    return { message: 'Friend request sent' };
  }

  async acceptFriendRequest(userId: string, targetId: string) {
    const incoming = await this.prisma.userRelationship.findUnique({
      where: { requesterId_targetId: { requesterId: targetId, targetId: userId } },
    });

    if (!incoming || incoming.type !== 'PENDING_OUTGOING') {
      throw new NotFoundException('No pending friend request found');
    }

    await this.prisma.$transaction([
      this.prisma.userRelationship.update({
        where: { requesterId_targetId: { requesterId: targetId, targetId: userId } },
        data: { type: 'FRIEND' },
      }),
      this.prisma.userRelationship.update({
        where: { requesterId_targetId: { requesterId: userId, targetId } },
        data: { type: 'FRIEND' },
      }),
    ]);

    return { message: 'Friend request accepted' };
  }

  async declineFriendRequest(userId: string, targetId: string) {
    await this.prisma.userRelationship.deleteMany({
      where: {
        OR: [
          { requesterId: userId, targetId },
          { requesterId: targetId, targetId: userId },
        ],
        type: { in: ['PENDING_OUTGOING', 'PENDING_INCOMING'] },
      },
    });
    return { message: 'Friend request declined' };
  }

  async removeFriend(userId: string, targetId: string) {
    await this.prisma.userRelationship.deleteMany({
      where: {
        OR: [
          { requesterId: userId, targetId },
          { requesterId: targetId, targetId: userId },
        ],
        type: 'FRIEND',
      },
    });
    return { message: 'Friend removed' };
  }

  async blockUser(userId: string, targetId: string) {
    if (userId === targetId) throw new BadRequestException('Cannot block yourself');

    await this.prisma.userRelationship.deleteMany({
      where: {
        OR: [
          { requesterId: userId, targetId },
          { requesterId: targetId, targetId: userId },
        ],
      },
    });

    await this.prisma.userRelationship.create({
      data: { requesterId: userId, targetId, type: 'BLOCKED' },
    });

    return { message: 'User blocked' };
  }

  async unblockUser(userId: string, targetId: string) {
    await this.prisma.userRelationship.deleteMany({
      where: { requesterId: userId, targetId, type: 'BLOCKED' },
    });
    return { message: 'User unblocked' };
  }

  async getMutualGuilds(userId: string, targetId: string) {
    const [userGuilds, targetGuilds] = await Promise.all([
      this.prisma.guildMember.findMany({
        where: { userId },
        select: { guildId: true },
      }),
      this.prisma.guildMember.findMany({
        where: { userId: targetId },
        select: { guildId: true },
      }),
    ]);

    const userGuildIds = new Set(userGuilds.map((m: any) => m.guildId));
    const mutualIds = targetGuilds
      .map((m: any) => m.guildId)
      .filter((id: string) => userGuildIds.has(id));

    return this.prisma.guild.findMany({
      where: { id: { in: mutualIds } },
      select: { id: true, name: true, icon: true, memberCount: true },
    });
  }

  async getPresence(userIds: string[]) {
    if (userIds.length === 0) return [];

    const presences = await this.prisma.presenceState.findMany({
      where: { userId: { in: userIds } },
      select: {
        userId: true,
        status: true,
        customStatusText: true,
        customStatusEmoji: true,
        lastSeenAt: true,
      },
    });

    // Check Redis for more recent presence updates
    const presenceMap = new Map(presences.map((p: any) => [p.userId, p]));

    // Batch Redis lookups with MGET instead of N individual calls
    const redisKeys = userIds.map((id) => `presence:${id}`);
    const redisValues = await this.redis.mget(...redisKeys);
    for (let i = 0; i < userIds.length; i++) {
      const raw = redisValues[i];
      if (raw) {
        try {
          presenceMap.set(userIds[i]!, JSON.parse(raw));
        } catch {
          // ignore malformed Redis presence
        }
      }
    }

    return Array.from(presenceMap.values());
  }
}
