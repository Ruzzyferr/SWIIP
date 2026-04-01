import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

/**
 * Internal endpoints for service-to-service communication.
 * Protected by X-Internal-Token header (INTERNAL_API_SECRET, falls back to JWT_SECRET).
 */
@Controller('internal')
export class InternalController {
  private readonly internalSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {
    this.internalSecret = this.config.get<string>('INTERNAL_API_SECRET')
      || this.config.get<string>('JWT_SECRET')
      || '';
  }

  private validateToken(token: string | undefined) {
    if (!token || !this.internalSecret) {
      throw new ForbiddenException('Invalid internal token');
    }
    const a = Buffer.from(token);
    const b = Buffer.from(this.internalSecret);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new ForbiddenException('Invalid internal token');
    }
  }

  @Get('channels/:id')
  async getChannel(
    @Param('id') id: string,
    @Headers('x-internal-token') token: string,
  ) {
    this.validateToken(token);
    const channel = await this.prisma.channel.findUnique({
      where: { id },
      select: { id: true, guildId: true, name: true, type: true },
    });
    if (!channel) throw new NotFoundException('Channel not found');
    return channel;
  }

  @Get('ready/:userId')
  async getReadyPayload(
    @Param('userId') userId: string,
    @Headers('x-internal-token') token: string,
  ) {
    this.validateToken(token);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        discriminator: true,
        globalName: true,
        avatarId: true,
        email: true,
        bannerId: true,
        bio: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    // Map avatarId/bannerId to avatar/banner for protocol compatibility
    const { avatarId: userAvatarId, bannerId: userBannerId, ...userRest } = user;
    const mappedUser = { ...userRest, avatar: userAvatarId ?? null, banner: userBannerId ?? null };

    const memberships = await this.prisma.guildMember.findMany({
      where: { userId },
      include: {
        guild: {
          include: {
            channels: { orderBy: [{ position: 'asc' }, { name: 'asc' }] },
            roles: { orderBy: { position: 'asc' } },
          },
        },
      },
    });

    const guilds = memberships.map((m) => {
      const guild = m.guild;
      const roles = guild.roles?.map((r) => {
        const { permissionsInteger, ...rest } = r;
        return { ...rest, permissions: (permissionsInteger ?? 0n).toString() };
      });
      return { ...guild, roles };
    });

    const dmParticipants = await this.prisma.dMParticipant.findMany({
      where: { userId, leftAt: null },
      include: {
        conversation: {
          include: {
            participants: {
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
            },
          },
        },
      },
      orderBy: { conversation: { updatedAt: 'desc' } },
      take: 50,
    });

    const dms = dmParticipants.map((p) => {
      const conv = p.conversation;
      const { participants, ...convRest } = conv;
      return {
        ...convRest,
        recipients: (participants ?? []).map((part) => {
          const u = part.user;
          if (!u) return part;
          const { avatarId, ...rest } = u;
          return { ...rest, avatar: avatarId ?? null };
        }),
      };
    });

    // Fetch read states for all channels the user has access to
    const readStates = await this.prisma.readState.findMany({
      where: { userId },
      select: {
        channelId: true,
        lastReadMessageId: true,
        mentionCount: true,
      },
    });

    // Fetch friend list and populate Redis friend set for gateway presence broadcasts
    const friendPresences: Array<{ userId: string; status: string }> = [];
    try {
      const friends = await this.prisma.userRelationship.findMany({
        where: { requesterId: userId, type: 'FRIEND' },
        select: { targetId: true },
      });
      const friendIds = friends.map((f) => f.targetId);
      const client = this.redis.getClient();
      const friendKey = `swiip:user_friends:${userId}`;
      if (friendIds.length > 0) {
        await client.del(friendKey);
        await client.sadd(friendKey, ...friendIds);
        await client.expire(friendKey, 86_400); // 24h TTL

        // Fetch real-time presence for all friends from Redis
        const pipeline = client.pipeline();
        for (const fid of friendIds) {
          pipeline.hgetall(`swiip:presence:${fid}`);
        }
        const results = await pipeline.exec();
        if (results) {
          for (let i = 0; i < friendIds.length; i++) {
            const [err, raw] = results[i] as [Error | null, Record<string, string>];
            if (!err && raw && raw['status'] && raw['status'] !== 'offline') {
              friendPresences.push({
                userId: friendIds[i]!,
                status: raw['status'],
              });
            }
          }
        }
      } else {
        await client.del(friendKey);
      }
    } catch {
      // Non-fatal — friend presence just won't work until next login
    }

    return { user: mappedUser, guilds, dms, readStates, friendPresences };
  }

  @Get('guilds/:guildId/member-ids')
  async getMemberIds(
    @Param('guildId') guildId: string,
    @Headers('x-internal-token') token: string,
  ) {
    this.validateToken(token);
    const members = await this.prisma.guildMember.findMany({
      where: { guildId },
      select: { userId: true },
    });
    return { memberIds: members.map((m) => m.userId) };
  }

  @Get('guilds/:guildId/members')
  async getMembers(
    @Param('guildId') guildId: string,
    @Headers('x-internal-token') token: string,
  ) {
    this.validateToken(token);
    const members = await this.prisma.guildMember.findMany({
      where: { guildId },
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
      take: 1000,
    });
    const mapped = members.map((m) => {
      if (!m.user) return m;
      const { avatarId, ...rest } = m.user;
      return { ...m, user: { ...rest, avatar: avatarId ?? null } };
    });
    return { members: mapped };
  }

  @Post('read-state')
  async updateReadState(
    @Headers('x-internal-token') token: string,
    @Body() body: { userId: string; channelId: string; lastReadMessageId: string },
  ) {
    this.validateToken(token);
    await this.prisma.readState.upsert({
      where: {
        userId_channelId: {
          userId: body.userId,
          channelId: body.channelId,
        },
      },
      update: { lastReadMessageId: body.lastReadMessageId },
      create: {
        userId: body.userId,
        channelId: body.channelId,
        lastReadMessageId: body.lastReadMessageId,
      },
    });
    return { ok: true };
  }

  @Post('users/:userId/presence')
  async updatePresenceState(
    @Param('userId') userId: string,
    @Headers('x-internal-token') token: string,
    @Body() body: { status: string; customStatusText?: string; customStatusEmoji?: string },
  ) {
    this.validateToken(token);

    const statusMap: Record<string, string> = {
      online: 'ONLINE',
      idle: 'IDLE',
      dnd: 'DND',
      offline: 'OFFLINE',
      invisible: 'INVISIBLE',
    };
    const dbStatus = (statusMap[body.status] ?? 'ONLINE') as UserStatus;

    await this.prisma.presenceState.upsert({
      where: { userId },
      create: {
        userId,
        status: dbStatus,
        customStatusText: body.customStatusText ?? null,
        customStatusEmoji: body.customStatusEmoji ?? null,
        lastSeenAt: new Date(),
      },
      update: {
        status: dbStatus,
        customStatusText: body.customStatusText ?? null,
        customStatusEmoji: body.customStatusEmoji ?? null,
        lastSeenAt: new Date(),
      },
    });

    return { ok: true };
  }

  @Get('users/:userId/presence')
  async getPresenceState(
    @Param('userId') userId: string,
    @Headers('x-internal-token') token: string,
  ) {
    this.validateToken(token);

    const state = await this.prisma.presenceState.findUnique({
      where: { userId },
      select: { status: true, customStatusText: true, customStatusEmoji: true },
    });

    if (!state) return { status: 'ONLINE', customStatusText: null, customStatusEmoji: null };
    return state;
  }
}
