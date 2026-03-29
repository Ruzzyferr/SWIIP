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
import { PrismaService } from '../prisma/prisma.service';

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
    const { avatarId: userAvatarId, bannerId: userBannerId, ...userRest } = user as any;
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

    const guilds = memberships.map((m: any) => m.guild);

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

    const dms = dmParticipants.map((p: any) => {
      const conv = p.conversation;
      const { participants, ...convRest } = conv;
      return {
        ...convRest,
        recipients: (participants ?? []).map((part: any) => {
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

    return { user: mappedUser, guilds, dms, readStates };
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
    return { memberIds: members.map((m: any) => m.userId) };
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
    const mapped = members.map((m: any) => {
      if (m.user) {
        const { avatarId, ...rest } = m.user;
        m.user = { ...rest, avatar: avatarId ?? null };
      }
      return m;
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
}
