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
import { PrismaService } from '../prisma/prisma.service';

/**
 * Internal endpoints for service-to-service communication.
 * Protected by X-Internal-Token header (JWT_SECRET).
 */
@Controller('internal')
export class InternalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private validateToken(token: string | undefined) {
    const secret = this.config.get('JWT_SECRET');
    if (!token || token !== secret) {
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

    const guilds = memberships.map((m) => m.guild);

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

    const dms = dmParticipants.map((p) => p.conversation);

    return { user, guilds, dms };
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
    return { members };
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
