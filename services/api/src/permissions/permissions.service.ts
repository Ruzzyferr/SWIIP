import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const Permissions = {
  CREATE_INSTANT_INVITE:         1n << 0n,
  KICK_MEMBERS:                  1n << 1n,
  BAN_MEMBERS:                   1n << 2n,
  ADMINISTRATOR:                 1n << 3n,
  MANAGE_CHANNELS:               1n << 4n,
  MANAGE_GUILD:                  1n << 5n,
  ADD_REACTIONS:                 1n << 6n,
  VIEW_AUDIT_LOG:                1n << 7n,
  PRIORITY_SPEAKER:              1n << 8n,
  STREAM:                        1n << 9n,
  VIEW_CHANNEL:                  1n << 10n,
  SEND_MESSAGES:                 1n << 11n,
  SEND_TTS_MESSAGES:             1n << 12n,
  MANAGE_MESSAGES:               1n << 13n,
  EMBED_LINKS:                   1n << 14n,
  ATTACH_FILES:                  1n << 15n,
  READ_MESSAGE_HISTORY:          1n << 16n,
  MENTION_EVERYONE:              1n << 17n,
  USE_EXTERNAL_EMOJIS:           1n << 18n,
  VIEW_GUILD_INSIGHTS:           1n << 19n,
  CONNECT:                       1n << 20n,
  SPEAK:                         1n << 21n,
  MUTE_MEMBERS:                  1n << 22n,
  DEAFEN_MEMBERS:                1n << 23n,
  MOVE_MEMBERS:                  1n << 24n,
  USE_VAD:                       1n << 25n,
  CHANGE_NICKNAME:               1n << 26n,
  MANAGE_NICKNAMES:              1n << 27n,
  MANAGE_ROLES:                  1n << 28n,
  MANAGE_WEBHOOKS:               1n << 29n,
  MANAGE_EMOJIS_AND_STICKERS:    1n << 30n,
  USE_APPLICATION_COMMANDS:      1n << 31n,
  REQUEST_TO_SPEAK:              1n << 32n,
  MANAGE_EVENTS:                 1n << 33n,
  MANAGE_THREADS:                1n << 34n,
  CREATE_PUBLIC_THREADS:         1n << 35n,
  CREATE_PRIVATE_THREADS:        1n << 36n,
  USE_EXTERNAL_STICKERS:         1n << 37n,
  SEND_MESSAGES_IN_THREADS:      1n << 38n,
  START_EMBEDDED_ACTIVITIES:     1n << 39n,
  MODERATE_MEMBERS:              1n << 40n,
};

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  hasPermission(permissions: bigint, bit: bigint): boolean {
    return (permissions & bit) === bit;
  }

  isAdministrator(permissions: bigint): boolean {
    return this.hasPermission(permissions, Permissions.ADMINISTRATOR);
  }

  addPermission(permissions: bigint, bit: bigint): bigint {
    return permissions | bit;
  }

  removePermission(permissions: bigint, bit: bigint): bigint {
    return permissions & ~bit;
  }

  computeBasePermissions(
    memberRoleIds: string[],
    roles: Array<{ id: string; permissionsInteger: bigint }>,
    everyoneRole: { permissionsInteger: bigint } | null,
    isOwner: boolean,
  ): bigint {
    if (isOwner) {
      return BigInt('0xFFFFFFFFFFFF');
    }

    let permissions = everyoneRole?.permissionsInteger ?? 0n;

    for (const role of roles) {
      if (memberRoleIds.includes(role.id)) {
        permissions |= role.permissionsInteger;
      }
    }

    if (this.isAdministrator(permissions)) {
      return BigInt('0xFFFFFFFFFFFF');
    }

    return permissions;
  }

  computeOverwritePermissions(
    basePerms: bigint,
    memberRoleIds: string[],
    userId: string,
    overwrites: Array<{
      targetId: string;
      targetType: string;
      allow: bigint;
      deny: bigint;
    }>,
    guildId?: string,
  ): bigint {
    if (this.isAdministrator(basePerms)) {
      return basePerms;
    }

    let permissions = basePerms;

    // Apply @everyone overwrite first (the @everyone role ID equals the guild ID)
    const everyoneOverwrite = overwrites.find(
      (o) => o.targetType === 'ROLE' && guildId && o.targetId === guildId,
    );
    if (everyoneOverwrite) {
      permissions &= ~everyoneOverwrite.deny;
      permissions |= everyoneOverwrite.allow;
    }

    // Apply role overwrites
    let roleAllow = 0n;
    let roleDeny = 0n;
    for (const overwrite of overwrites) {
      if (overwrite.targetType === 'ROLE' && memberRoleIds.includes(overwrite.targetId)) {
        roleAllow |= overwrite.allow;
        roleDeny |= overwrite.deny;
      }
    }
    permissions &= ~roleDeny;
    permissions |= roleAllow;

    // Apply member overwrite last
    const memberOverwrite = overwrites.find(
      (o) => o.targetType === 'MEMBER' && o.targetId === userId,
    );
    if (memberOverwrite) {
      permissions &= ~memberOverwrite.deny;
      permissions |= memberOverwrite.allow;
    }

    return permissions;
  }

  async computePermissionsForUser(
    userId: string,
    guildId: string,
    channelId?: string,
  ): Promise<bigint> {
    const guild = await this.prisma.guild.findUnique({
      where: { id: guildId },
      select: { ownerId: true },
    });

    if (!guild) return 0n;

    if (guild.ownerId === userId) {
      return BigInt('0xFFFFFFFFFFFF');
    }

    const member = await this.prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId } },
      select: { roles: true },
    });

    if (!member) return 0n;

    const roles = await this.prisma.role.findMany({
      where: { guildId },
      select: { id: true, permissionsInteger: true, name: true },
    });

    const everyoneRole = roles.find((r) => r.name === '@everyone') ?? null;
    const basePerms = this.computeBasePermissions(
      member.roles,
      roles,
      everyoneRole,
      false,
    );

    if (!channelId) return basePerms;

    const overwrites = await this.prisma.permissionOverwrite.findMany({
      where: { channelId },
      select: { targetId: true, targetType: true, allow: true, deny: true },
    });

    return this.computeOverwritePermissions(
      basePerms,
      member.roles,
      userId,
      overwrites,
      guildId,
    );
  }

  async canViewChannel(userId: string, channelId: string): Promise<boolean> {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: { guildId: true, type: true },
    });

    if (!channel || !channel.guildId) return true;

    const perms = await this.computePermissionsForUser(
      userId,
      channel.guildId,
      channelId,
    );

    return this.hasPermission(perms, Permissions.VIEW_CHANNEL);
  }
}
