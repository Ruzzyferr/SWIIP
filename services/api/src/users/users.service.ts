import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, UserStatus } from '@prisma/client';
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
    private readonly eventEmitter: EventEmitter2,
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

  async deleteAccount(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Anonymize the user record instead of hard-deleting so message history is preserved
    const deletedTag = `deleted_user_${userId.slice(0, 8)}`;
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Remove all sessions
      await tx.session.deleteMany({ where: { userId } });

      // Remove presence
      await tx.presenceState.deleteMany({ where: { userId } });

      // Remove relationships (friends, blocks, pending)
      await tx.userRelationship.deleteMany({
        where: { OR: [{ requesterId: userId }, { targetId: userId }] },
      });

      // Remove DM participations
      await tx.dMParticipant.deleteMany({ where: { userId } });

      // Remove guild memberships
      await tx.guildMember.deleteMany({ where: { userId } });

      // Anonymize user record
      await tx.user.update({
        where: { id: userId },
        data: {
          username: deletedTag,
          globalName: 'Deleted User',
          email: `${deletedTag}@deleted.local`,
          passwordHash: '',
          avatarId: null,
          bannerId: null,
          bio: null,
          mfaEnabled: false,
          mfaSecret: null,
          mfaBackupCodes: [],
          verified: false,
        },
      });
    });

    // Clean up Redis presence
    await this.redis.del(`presence:${userId}`);

    this.eventEmitter.emit('user.deleted', { userId });
  }

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

  private mapUserFields(user: { avatarId?: string | null; bannerId?: string | null } & Record<string, unknown>) {
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

    // Only check the requester's own perspective row
    const relationship = await this.prisma.userRelationship.findUnique({
      where: { requesterId_targetId: { requesterId, targetId: userId } },
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

    return members.map((m) => ({
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

    return relationships.map((r) => {
      const friend = r.requesterId === userId ? r.target : r.requester;
      return this.mapUserFields(friend);
    });
  }

  async getRelationships(userId: string) {
    // Each relationship creates TWO rows: one per user with their own perspective type.
    // We only return rows where requesterId=userId to get the correct perspective.
    const rows = await this.prisma.userRelationship.findMany({
      where: { requesterId: userId },
      include: { target: { select: this.PUBLIC_SELECT } },
    });

    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      user: this.mapUserFields(r.target),
      since: new Date().toISOString(),
    }));
  }

  async sendFriendRequest(requesterId: string, targetUsername: string, discriminator: string) {
    const target = await this.prisma.user.findUnique({
      where: { username_discriminator: { username: targetUsername, discriminator } },
      select: { ...this.PUBLIC_SELECT },
    });

    if (!target) throw new NotFoundException('User not found');
    if (target.id === requesterId) throw new BadRequestException('Cannot add yourself');

    // Check BOTH rows explicitly — each user has their own perspective row
    const myRow = await this.prisma.userRelationship.findUnique({
      where: { requesterId_targetId: { requesterId, targetId: target.id } },
    });
    const theirRow = await this.prisma.userRelationship.findUnique({
      where: { requesterId_targetId: { requesterId: target.id, targetId: requesterId } },
    });

    // Block checks
    if (myRow?.type === 'BLOCKED') throw new ForbiddenException('You have this user blocked');
    if (theirRow?.type === 'BLOCKED') throw new ForbiddenException('Cannot send friend request');

    // Already friends
    if (myRow?.type === 'FRIEND') throw new ConflictException('Already friends');

    // Already sent a pending request
    if (myRow?.type === 'PENDING_OUTGOING') throw new ConflictException('Friend request already sent');

    // They already sent us a request — auto-accept
    if (myRow?.type === 'PENDING_INCOMING') {
      return this.acceptFriendRequest(requesterId, target.id);
    }

    // Create both perspective rows
    await this.prisma.$transaction([
      this.prisma.userRelationship.create({
        data: { requesterId, targetId: target.id, type: 'PENDING_OUTGOING' },
      }),
      this.prisma.userRelationship.create({
        data: { requesterId: target.id, targetId: requesterId, type: 'PENDING_INCOMING' },
      }),
    ]);

    // Emit event for real-time delivery
    const requester = await this.findByIdPublic(requesterId);
    this.eventEmitter.emit('relationship.requestSent', {
      requesterId,
      targetId: target.id,
      requesterUser: requester,
      targetUser: this.mapUserFields(target),
    });

    return { message: 'Friend request sent' };
  }

  async acceptFriendRequest(userId: string, targetId: string) {
    // Verify the user actually has a PENDING_INCOMING from target
    const myRow = await this.prisma.userRelationship.findUnique({
      where: { requesterId_targetId: { requesterId: userId, targetId } },
    });

    if (!myRow || myRow.type !== 'PENDING_INCOMING') {
      throw new NotFoundException('No pending friend request found');
    }

    await this.prisma.$transaction([
      this.prisma.userRelationship.update({
        where: { requesterId_targetId: { requesterId: userId, targetId } },
        data: { type: 'FRIEND' },
      }),
      this.prisma.userRelationship.update({
        where: { requesterId_targetId: { requesterId: targetId, targetId: userId } },
        data: { type: 'FRIEND' },
      }),
    ]);

    // Emit event for real-time delivery
    const acceptedUser = await this.findByIdPublic(userId);
    const friendUser = await this.findByIdPublic(targetId);
    this.eventEmitter.emit('relationship.accepted', {
      userId,
      targetId,
      acceptedUser,
      friendUser,
    });

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

    this.eventEmitter.emit('relationship.removed', { userId, targetId });

    return { message: 'Friend request declined' };
  }

  async removeFriend(userId: string, targetId: string) {
    // Remove ANY relationship between the two users (friend or pending)
    await this.prisma.userRelationship.deleteMany({
      where: {
        OR: [
          { requesterId: userId, targetId },
          { requesterId: targetId, targetId: userId },
        ],
        type: { in: ['FRIEND', 'PENDING_OUTGOING', 'PENDING_INCOMING'] },
      },
    });

    this.eventEmitter.emit('relationship.removed', { userId, targetId });

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

    const userGuildIds = new Set(userGuilds.map((m) => m.guildId));
    const mutualIds = targetGuilds
      .map((m) => m.guildId)
      .filter((id) => userGuildIds.has(id));

    return this.prisma.guild.findMany({
      where: { id: { in: mutualIds } },
      select: { id: true, name: true, icon: true, memberCount: true },
    });
  }

  async getPresence(userIds: string[]) {
    if (userIds.length === 0) return [];

    type PresenceSnapshot = {
      userId: string;
      status: UserStatus;
      customStatusText: string | null;
      customStatusEmoji: string | null;
      lastSeenAt: Date | null;
    };

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

    const presenceMap = new Map<string, PresenceSnapshot>(
      presences.map((p) => [
        p.userId,
        {
          userId: p.userId,
          status: p.status,
          customStatusText: p.customStatusText,
          customStatusEmoji: p.customStatusEmoji,
          lastSeenAt: p.lastSeenAt,
        },
      ]),
    );

    const client = this.redis.getClient();
    const pipeline = client.pipeline();
    for (const id of userIds) {
      pipeline.hgetall(`swiip:presence:${id}`);
    }
    const results = await pipeline.exec();
    if (results) {
      for (let i = 0; i < userIds.length; i++) {
        const [err, raw] = results[i] as [Error | null, Record<string, string>];
        if (!err && raw && raw['status']) {
          const statusMap: Record<string, UserStatus> = {
            online: 'ONLINE',
            idle: 'IDLE',
            dnd: 'DND',
            offline: 'OFFLINE',
            invisible: 'INVISIBLE',
          };
          const uid = userIds[i]!;
          const redisKey = raw['status'];
          const status =
            statusMap[redisKey] ?? (redisKey.toUpperCase() as UserStatus);
          presenceMap.set(uid, {
            userId: uid,
            status,
            customStatusText: raw['customStatus'] || null,
            customStatusEmoji: null,
            lastSeenAt: raw['updatedAt'] ? new Date(parseInt(raw['updatedAt'], 10)) : null,
          });
        }
      }
    }

    return Array.from(presenceMap.values());
  }
}
