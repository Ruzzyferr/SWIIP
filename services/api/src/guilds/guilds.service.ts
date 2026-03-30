import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  IsString,
  IsOptional,
  MaxLength,
  IsInt,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Permissions } from '../permissions/permissions.service';

export class CreateGuildDto {
  @ApiProperty() @IsString() @MaxLength(100) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() icon?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() preferredLocale?: string;
}

export class UpdateGuildDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() icon?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() banner?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() splash?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() afkTimeout?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() preferredLocale?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDiscoverable?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() vanityUrlCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() systemChannelId?: string;
}

export class UpdateMemberDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32) nick?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() deaf?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() mute?: boolean;
  @ApiPropertyOptional() @IsOptional() roles?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() timeoutUntil?: string;
}

@Injectable()
export class GuildsService {
  private readonly logger = new Logger(GuildsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Map avatarId → avatar on a user sub-object for protocol compatibility */
  private mapMemberUser(member: any) {
    if (member?.user) {
      const { avatarId, bannerId, ...rest } = member.user;
      member = { ...member, user: { ...rest, avatar: avatarId ?? null, ...(bannerId !== undefined ? { banner: bannerId ?? null } : {}) } };
    }
    return member;
  }

  async create(userId: string, dto: CreateGuildDto) {
    const guild = await this.prisma.$transaction(async (tx: any) => {
      const newGuild = await tx.guild.create({
        data: {
          name: dto.name,
          description: dto.description,
          icon: dto.icon,
          ownerId: userId,
          preferredLocale: dto.preferredLocale ?? 'en',
          memberCount: 1,
        },
      });

      // Create @everyone role
      const everyoneRole = await tx.role.create({
        data: {
          guildId: newGuild.id,
          name: '@everyone',
          position: 0,
          permissionsInteger:
            Permissions.VIEW_CHANNEL |
            Permissions.SEND_MESSAGES |
            Permissions.READ_MESSAGE_HISTORY |
            Permissions.ADD_REACTIONS |
            Permissions.CONNECT |
            Permissions.SPEAK |
            Permissions.USE_APPLICATION_COMMANDS,
        },
      });

      // Create Admin role for the server owner
      const adminRole = await tx.role.create({
        data: {
          guildId: newGuild.id,
          name: 'Admin',
          position: 1,
          color: 0xE74C3C, // Red color to distinguish admins
          hoist: true,
          permissionsInteger: Permissions.ADMINISTRATOR,
        },
      });

      // Create General category
      const generalCategory = await tx.category.create({
        data: {
          guildId: newGuild.id,
          name: 'General',
          position: 0,
        },
      });

      // Create general text channel
      const generalText = await tx.channel.create({
        data: {
          guildId: newGuild.id,
          name: 'general',
          type: 'TEXT',
          position: 0,
          parentId: generalCategory.id,
        },
      });

      // Create general voice channel
      await tx.channel.create({
        data: {
          guildId: newGuild.id,
          name: 'General',
          type: 'VOICE',
          position: 1,
          parentId: generalCategory.id,
          bitrate: 64000,
          userLimit: 0,
        },
      });

      // Update guild system channel
      await tx.guild.update({
        where: { id: newGuild.id },
        data: { systemChannelId: generalText.id },
      });

      // Add owner as member with Admin role
      await tx.guildMember.create({
        data: {
          guildId: newGuild.id,
          userId,
          roles: [everyoneRole.id, adminRole.id],
          isOwner: true,
        },
      });

      return newGuild;
    });

    this.eventEmitter.emit('guild.created', { guildId: guild.id, ownerId: userId });
    this.logger.log(`Guild created: ${guild.name} by ${userId}`);

    return this.findById(guild.id, userId);
  }

  async findById(id: string, requesterId: string) {
    const guild = await this.prisma.guild.findUnique({
      where: { id },
      include: {
        roles: { orderBy: { position: 'asc' } },
        channels: { orderBy: [{ position: 'asc' }, { name: 'asc' }] },
        categories: { orderBy: { position: 'asc' } },
        members: {
          where: { userId: requesterId },
          select: { roles: true, nick: true, joinedAt: true, isOwner: true },
          take: 1,
        },
        _count: { select: { members: true } },
      },
    });

    if (!guild) throw new NotFoundException('Guild not found');

    const member = guild.members[0];
    if (!member) throw new ForbiddenException('Not a member of this guild');

    return { ...guild, members: undefined, currentMember: member };
  }

  async update(guildId: string, userId: string, dto: UpdateGuildDto) {
    const guild = await this.prisma.guild.findUnique({ where: { id: guildId } });
    if (!guild) throw new NotFoundException('Guild not found');
    if (guild.ownerId !== userId) {
      throw new ForbiddenException('Only the guild owner can update guild settings');
    }

    if (dto.vanityUrlCode) {
      const existing = await this.prisma.guild.findUnique({
        where: { vanityUrlCode: dto.vanityUrlCode },
      });
      if (existing && existing.id !== guildId) {
        throw new ConflictException('Vanity URL already taken');
      }
    }

    const updated = await this.prisma.guild.update({
      where: { id: guildId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.banner !== undefined && { banner: dto.banner }),
        ...(dto.splash !== undefined && { splash: dto.splash }),
        ...(dto.afkTimeout !== undefined && { afkTimeout: dto.afkTimeout }),
        ...(dto.preferredLocale && { preferredLocale: dto.preferredLocale }),
        ...(dto.isDiscoverable !== undefined && { isDiscoverable: dto.isDiscoverable }),
        ...(dto.vanityUrlCode !== undefined && { vanityUrlCode: dto.vanityUrlCode }),
        ...(dto.systemChannelId !== undefined && { systemChannelId: dto.systemChannelId }),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        guildId,
        actorId: userId,
        action: 'GUILD_UPDATE',
        changes: dto as any,
      },
    });

    this.eventEmitter.emit('guild.updated', { guildId, actorId: userId });
    return updated;
  }

  async delete(guildId: string, ownerId: string) {
    const guild = await this.prisma.guild.findUnique({ where: { id: guildId } });
    if (!guild) throw new NotFoundException('Guild not found');
    if (guild.ownerId !== ownerId) {
      throw new ForbiddenException('Only the guild owner can delete the guild');
    }

    await this.prisma.guild.delete({ where: { id: guildId } });
    this.eventEmitter.emit('guild.deleted', { guildId, ownerId });
    this.logger.log(`Guild deleted: ${guildId} by ${ownerId}`);
    return { message: 'Guild deleted' };
  }

  async getMembers(
    guildId: string,
    options: { limit?: number; after?: string } = {},
  ) {
    const parsedLimit = Number(options.limit);
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(Math.floor(parsedLimit), 1000)
      : 100;

    return this.prisma.guildMember.findMany({
      where: {
        guildId,
        ...(options.after && { userId: { gt: options.after } }),
      },
      include: {
        user: {
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
      },
      take: limit,
      orderBy: { userId: 'asc' },
    }).then((members: any[]) => members.map((m) => this.mapMemberUser(m)));
  }

  async getMember(guildId: string, userId: string) {
    const member = await this.prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId } },
      include: {
        user: {
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
      },
    });

    if (!member) throw new NotFoundException('Member not found');
    return this.mapMemberUser(member);
  }

  async addMember(guildId: string, userId: string, inviteCode?: string) {
    const guild = await this.prisma.guild.findUnique({ where: { id: guildId } });
    if (!guild) throw new NotFoundException('Guild not found');

    const existing = await this.prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });
    if (existing) return existing;

    const everyoneRole = await this.prisma.role.findFirst({
      where: { guildId, name: '@everyone' },
    });

    const member = await this.prisma.$transaction(async (tx: any) => {
      const newMember = await tx.guildMember.create({
        data: {
          guildId,
          userId,
          roles: everyoneRole ? [everyoneRole.id] : [],
        },
      });

      await tx.guild.update({
        where: { id: guildId },
        data: { memberCount: { increment: 1 } },
      });

      return newMember;
    });

    this.eventEmitter.emit('guild.memberAdd', { guildId, userId });
    return member;
  }

  async removeMember(guildId: string, actorId: string, targetId: string, reason?: string) {
    const guild = await this.prisma.guild.findUnique({ where: { id: guildId } });
    if (!guild) throw new NotFoundException('Guild not found');
    if (guild.ownerId === targetId) throw new BadRequestException('Cannot kick the guild owner');

    const targetMember = await this.prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: targetId } },
    });
    if (!targetMember) throw new NotFoundException('Member not found');

    await this.prisma.$transaction(async (tx: any) => {
      await tx.guildMember.delete({
        where: { guildId_userId: { guildId, userId: targetId } },
      });
      await tx.guild.update({
        where: { id: guildId },
        data: { memberCount: { decrement: 1 } },
      });
      await tx.auditLog.create({
        data: {
          guildId,
          actorId,
          targetId,
          targetType: 'USER',
          action: 'MEMBER_KICK',
          reason,
        },
      });
    });

    this.eventEmitter.emit('guild.memberRemove', { guildId, userId: targetId, actorId, reason });
    return { message: 'Member kicked' };
  }

  async updateMember(guildId: string, actorId: string, targetId: string, dto: UpdateMemberDto) {
    const member = await this.prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: targetId } },
    });
    if (!member) throw new NotFoundException('Member not found');

    const updated = await this.prisma.guildMember.update({
      where: { guildId_userId: { guildId, userId: targetId } },
      data: {
        ...(dto.nick !== undefined && { nick: dto.nick }),
        ...(dto.deaf !== undefined && { deaf: dto.deaf }),
        ...(dto.mute !== undefined && { mute: dto.mute }),
        ...(dto.roles !== undefined && { roles: dto.roles }),
        ...(dto.timeoutUntil !== undefined && {
          timeoutUntil: dto.timeoutUntil ? new Date(dto.timeoutUntil) : null,
        }),
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

    await this.prisma.auditLog.create({
      data: {
        guildId,
        actorId,
        targetId,
        targetType: 'USER',
        action: 'MEMBER_UPDATE',
        changes: dto as any,
      },
    });

    const mappedUpdated = this.mapMemberUser(updated);
    this.eventEmitter.emit('guild.memberUpdate', { guildId, userId: targetId, member: mappedUpdated });

    return mappedUpdated;
  }

  async banMember(
    guildId: string,
    actorId: string,
    targetId: string,
    reason?: string,
    deleteMessageDays = 0,
  ) {
    const guild = await this.prisma.guild.findUnique({ where: { id: guildId } });
    if (!guild) throw new NotFoundException('Guild not found');
    if (guild.ownerId === targetId) throw new BadRequestException('Cannot ban the guild owner');

    const existingBan = await this.prisma.moderationAction.findFirst({
      where: { guildId, targetId, type: 'BAN', active: true },
    });
    if (existingBan) throw new ConflictException('User is already banned');

    await this.prisma.$transaction(async (tx: any) => {
      const memberExists = await tx.guildMember.findUnique({
        where: { guildId_userId: { guildId, userId: targetId } },
      });

      if (memberExists) {
        await tx.guildMember.delete({
          where: { guildId_userId: { guildId, userId: targetId } },
        });
        await tx.guild.update({
          where: { id: guildId },
          data: { memberCount: { decrement: 1 } },
        });
      }

      await tx.moderationAction.create({
        data: { guildId, targetId, actorId, type: 'BAN', reason },
      });

      await tx.auditLog.create({
        data: {
          guildId,
          actorId,
          targetId,
          targetType: 'USER',
          action: 'MEMBER_BAN_ADD',
          reason,
        },
      });
    });

    return { message: 'User banned' };
  }

  async unbanMember(guildId: string, actorId: string, targetId: string) {
    const ban = await this.prisma.moderationAction.findFirst({
      where: { guildId, targetId, type: 'BAN', active: true },
    });
    if (!ban) throw new NotFoundException('No active ban found for this user');

    await this.prisma.moderationAction.update({
      where: { id: ban.id },
      data: { active: false },
    });

    await this.prisma.auditLog.create({
      data: {
        guildId,
        actorId,
        targetId,
        targetType: 'USER',
        action: 'MEMBER_BAN_REMOVE',
      },
    });

    return { message: 'User unbanned' };
  }

  async getBans(guildId: string) {
    return this.prisma.moderationAction.findMany({
      where: { guildId, type: 'BAN', active: true },
      include: {
        target: {
          select: {
            id: true,
            username: true,
            discriminator: true,
            globalName: true,
            avatarId: true,
          },
        },
        actor: {
          select: {
            id: true,
            username: true,
            discriminator: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInvites(guildId: string) {
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

  async leave(guildId: string, userId: string) {
    const guild = await this.prisma.guild.findUnique({ where: { id: guildId } });
    if (!guild) throw new NotFoundException('Guild not found');
    if (guild.ownerId === userId) {
      throw new BadRequestException('Owner must transfer ownership before leaving');
    }

    const member = await this.prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });
    if (!member) throw new NotFoundException('Not a member of this guild');

    await this.prisma.$transaction(async (tx: any) => {
      await tx.guildMember.delete({
        where: { guildId_userId: { guildId, userId } },
      });
      await tx.guild.update({
        where: { id: guildId },
        data: { memberCount: { decrement: 1 } },
      });
    });

    this.eventEmitter.emit('guild.memberLeave', { guildId, userId });
    return { message: 'Left guild' };
  }

  async transferOwnership(guildId: string, currentOwnerId: string, newOwnerId: string) {
    const guild = await this.prisma.guild.findUnique({ where: { id: guildId } });
    if (!guild) throw new NotFoundException('Guild not found');
    if (guild.ownerId !== currentOwnerId) throw new ForbiddenException('Not the guild owner');

    const newOwnerMember = await this.prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: newOwnerId } },
    });
    if (!newOwnerMember) throw new NotFoundException('New owner is not a member of this guild');

    await this.prisma.$transaction(async (tx: any) => {
      await tx.guild.update({
        where: { id: guildId },
        data: { ownerId: newOwnerId },
      });
      await tx.guildMember.update({
        where: { guildId_userId: { guildId, userId: newOwnerId } },
        data: { isOwner: true },
      });
      await tx.guildMember.update({
        where: { guildId_userId: { guildId, userId: currentOwnerId } },
        data: { isOwner: false },
      });
    });

    return { message: 'Ownership transferred' };
  }
}
