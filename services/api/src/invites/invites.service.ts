import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { nanoid } from 'nanoid';
import { IsOptional, IsInt, IsBoolean, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInviteDto {
  @ApiPropertyOptional({ description: 'Max age in seconds (0 = never expire)', default: 86400 })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxAge?: number;

  @ApiPropertyOptional({ description: 'Max uses (0 = unlimited)', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxUses?: number;

  @ApiPropertyOptional({ description: 'Temporary membership', default: false })
  @IsOptional()
  @IsBoolean()
  temporary?: boolean;
}

@Injectable()
export class InvitesService {
  private readonly logger = new Logger(InvitesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(channelId: string, userId: string, dto: CreateInviteDto) {
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
            globalName: true,
            avatarId: true,
          },
        },
        channel: { select: { id: true, name: true, type: true } },
        guild: {
          select: {
            id: true,
            name: true,
            icon: true,
            memberCount: true,
            verificationLevel: true,
          },
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        guildId: channel.guildId,
        actorId: userId,
        targetId: invite.id,
        targetType: 'INVITE',
        action: 'INVITE_CREATE',
      },
    });

    this.logger.log(`Invite created: ${invite.code} for guild ${channel.guildId}`);
    return invite;
  }

  async resolve(code: string) {
    const invite = await this.prisma.invite.findUnique({
      where: { code },
      include: {
        inviter: {
          select: {
            id: true,
            username: true,
            discriminator: true,
            globalName: true,
            avatarId: true,
          },
        },
        channel: { select: { id: true, name: true, type: true } },
        guild: {
          select: {
            id: true,
            name: true,
            icon: true,
            banner: true,
            description: true,
            memberCount: true,
            verificationLevel: true,
            features: true,
            boostTier: true,
          },
        },
      },
    });

    if (!invite) throw new NotFoundException('Invalid invite code');

    if (invite.expiresAt && invite.expiresAt < new Date()) {
      throw new BadRequestException('Invite has expired');
    }

    if (invite.maxUses > 0 && invite.uses >= invite.maxUses) {
      throw new BadRequestException('Invite has reached its maximum uses');
    }

    return invite;
  }

  async use(code: string, userId: string) {
    const invite = await this.resolve(code);

    const existingMember = await this.prisma.guildMember.findUnique({
      where: {
        guildId_userId: { guildId: invite.guildId, userId },
      },
    });

    if (existingMember) {
      return { message: 'Already a member', guild: invite.guild };
    }

    const activeBan = await this.prisma.moderationAction.findFirst({
      where: {
        guildId: invite.guildId,
        targetId: userId,
        type: 'BAN',
        active: true,
      },
    });
    if (activeBan) {
      throw new ForbiddenException('You are banned from this guild');
    }

    const everyoneRole = await this.prisma.role.findFirst({
      where: { guildId: invite.guildId, name: '@everyone' },
    });

    await this.prisma.$transaction(async (tx: any) => {
      await tx.guildMember.create({
        data: {
          guildId: invite.guildId,
          userId,
          roles: everyoneRole ? [everyoneRole.id] : [],
        },
      });

      await tx.guild.update({
        where: { id: invite.guildId },
        data: { memberCount: { increment: 1 } },
      });

      const updatedInvite = await tx.invite.update({
        where: { code },
        data: { uses: { increment: 1 } },
      });

      if (updatedInvite.maxUses > 0 && updatedInvite.uses >= updatedInvite.maxUses) {
        await tx.invite.delete({ where: { code } });
      }
    });

    this.eventEmitter.emit('guild.memberAdd', { guildId: invite.guildId, userId, inviteCode: code });
    this.logger.log(`User ${userId} joined guild ${invite.guildId} via invite ${code}`);

    return { message: 'Joined guild', guild: invite.guild };
  }

  async revoke(code: string, actorId: string) {
    const invite = await this.prisma.invite.findUnique({ where: { code } });
    if (!invite) throw new NotFoundException('Invite not found');

    await this.prisma.invite.delete({ where: { code } });

    await this.prisma.auditLog.create({
      data: {
        guildId: invite.guildId,
        actorId,
        targetId: invite.id,
        targetType: 'INVITE',
        action: 'INVITE_DELETE',
      },
    });

    return { message: 'Invite revoked' };
  }

  async getGuildInvites(guildId: string, actorId: string) {
    return this.prisma.invite.findMany({
      where: { guildId },
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
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
