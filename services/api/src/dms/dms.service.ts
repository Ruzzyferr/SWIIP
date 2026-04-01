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
import { mapMessageForClient } from '../messages/message-serialize.util';
import { Prisma } from '@prisma/client';

/** Participant row as loaded for DM payload shaping (user subset varies by query). */
type DMParticipantForPayload = {
  userId: string;
  user?: {
    id: string;
    username: string;
    discriminator: string;
    globalName: string | null;
    avatarId: string | null;
    flags?: bigint;
  } | null;
};

type DMConversationForPayload = {
  id: string;
  type: string;
  name: string | null;
  ownerId?: string | null;
  updatedAt?: Date;
  createdAt?: Date;
  participants?: DMParticipantForPayload[];
  [key: string]: unknown;
};

type RecipientPublic = Omit<NonNullable<DMParticipantForPayload['user']>, 'avatarId' | 'flags'> & {
  avatar: string | null;
};

type RecipientsResult = Array<DMParticipantForPayload | RecipientPublic>;

const participationListInclude = {
  conversation: {
    include: {
      participants: {
        where: { leftAt: null },
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
} satisfies Prisma.DMParticipantInclude;

type DMParticipationListRow = Prisma.DMParticipantGetPayload<{ include: typeof participationListInclude }>;

type DMChannelMessageRow = Prisma.MessageGetPayload<{
  include: {
    author: {
      select: {
        id: true;
        username: true;
        discriminator: true;
        globalName: true;
        avatarId: true;
      };
    };
    attachments: true;
    reactions: true;
  };
}>;

@Injectable()
export class DMsService {
  private readonly logger = new Logger(DMsService.name);
  private readonly MAX_GROUP_DM_MEMBERS = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Ensure a Channel record exists for a DM conversation (backfill for old conversations) */
  private async ensureChannelRecord(conversationId: string, type: 'DM' | 'GROUP_DM', name?: string) {
    const existing = await this.prisma.channel.findUnique({ where: { id: conversationId } });
    if (!existing) {
      await this.prisma.channel.create({
        data: {
          id: conversationId,
          name: name ?? (type === 'DM' ? 'DM' : 'Group DM'),
          type,
          guildId: null,
        },
      }).catch(() => {
        // Race condition: another request may have created it
      });
    }
  }

  /** Map participants array to recipients (UserPayload[]) with avatar/banner fields */
  private toRecipients(participants: DMParticipantForPayload[]): RecipientsResult {
    return participants.map((p) => {
      const u = p.user;
      if (!u) return p;
      const { avatarId, flags: _flags, ...rest } = u;
      return { ...rest, avatar: avatarId ?? null };
    });
  }

  /** Transform a raw conversation record into DMChannelPayload shape */
  private toDMPayload(conv: DMConversationForPayload): Omit<DMConversationForPayload, 'participants'> & { recipients: RecipientsResult } {
    const { participants, ...rest } = conv;
    return {
      ...rest,
      recipients: this.toRecipients(participants ?? []),
    };
  }

  async getOrCreateDM(userId: string, targetId: string) {
    if (userId === targetId) {
      throw new BadRequestException('Cannot DM yourself');
    }

    // Check if DM already exists
    const existingConversation = await this.prisma.dMConversation.findFirst({
      where: {
        type: 'DM',
        participants: {
          every: {
            userId: { in: [userId, targetId] },
            leftAt: null,
          },
        },
      },
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
    });

    if (existingConversation) {
      const participantIds = existingConversation.participants.map((p) => p.userId);
      if (participantIds.includes(userId) && participantIds.includes(targetId)) {
        // Backfill Channel record for pre-existing DM conversations
        await this.ensureChannelRecord(existingConversation.id, 'DM');
        return this.toDMPayload(existingConversation);
      }
    }

    // Create new DM conversation + a matching Channel record so messages/ack work
    const conversation = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const conv = await tx.dMConversation.create({
        data: {
          type: 'DM',
          participants: {
            create: [
              { userId },
              { userId: targetId },
            ],
          },
        },
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
      });

      // Create a Channel record with the same ID so Message FK works
      await tx.channel.create({
        data: {
          id: conv.id,
          name: 'DM',
          type: 'DM',
          guildId: null,
        },
      });

      return conv;
    });

    this.logger.log(`DM created between ${userId} and ${targetId}`);
    this.eventEmitter.emit('dm.created', { conversationId: conversation.id, userId, targetId });

    return this.toDMPayload(conversation);
  }

  async createGroupDM(userId: string, recipientIds: string[], name?: string) {
    const allIds = [userId, ...recipientIds.filter((id) => id !== userId)];
    const uniqueIds = [...new Set(allIds)];

    if (uniqueIds.length < 2) {
      throw new BadRequestException('Group DM requires at least 2 members');
    }

    if (uniqueIds.length > this.MAX_GROUP_DM_MEMBERS) {
      throw new BadRequestException(`Group DMs are limited to ${this.MAX_GROUP_DM_MEMBERS} members`);
    }

    const conversation = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const conv = await tx.dMConversation.create({
        data: {
          type: 'GROUP_DM',
          name: name ?? `Group DM (${uniqueIds.length})`,
          ownerId: userId,
          participants: {
            create: uniqueIds.map((uid) => ({ userId: uid })),
          },
        },
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
      });

      // Create a Channel record with the same ID so Message FK works
      await tx.channel.create({
        data: {
          id: conv.id,
          name: conv.name ?? 'Group DM',
          type: 'GROUP_DM',
          guildId: null,
        },
      });

      return conv;
    });

    this.logger.log(`Group DM created by ${userId} with ${uniqueIds.length} members`);
    this.eventEmitter.emit('dm.groupCreated', { conversationId: conversation.id, userId });

    return this.toDMPayload(conversation);
  }

  async addGroupDMMember(conversationId: string, userId: string, targetId: string) {
    const conversation = await this.prisma.dMConversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: { where: { leftAt: null } },
      },
    });

    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.type !== 'GROUP_DM') {
      throw new BadRequestException('Not a group DM');
    }

    const isParticipant = conversation.participants.some((p) => p.userId === userId);
    if (!isParticipant) throw new ForbiddenException('Not a participant in this conversation');

    const activeParticipantCount = conversation.participants.length;
    if (activeParticipantCount >= this.MAX_GROUP_DM_MEMBERS) {
      throw new BadRequestException(`Group DMs are limited to ${this.MAX_GROUP_DM_MEMBERS} members`);
    }

    const alreadyMember = conversation.participants.some((p) => p.userId === targetId);
    if (alreadyMember) throw new ConflictException('User is already in this conversation');

    const participant = await this.prisma.dMParticipant.upsert({
      where: {
        conversationId_userId: { conversationId, userId: targetId },
      },
      update: { leftAt: null },
      create: { conversationId, userId: targetId },
    });

    this.eventEmitter.emit('dm.memberAdd', { conversationId, userId: targetId, addedBy: userId });
    return participant;
  }

  async removeGroupDMMember(conversationId: string, userId: string, targetId: string) {
    const conversation = await this.prisma.dMConversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: { where: { leftAt: null } },
      },
    });

    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.type !== 'GROUP_DM') {
      throw new BadRequestException('Not a group DM');
    }

    const isOwner = conversation.ownerId === userId;
    if (userId !== targetId && !isOwner) {
      throw new ForbiddenException('Only the owner can remove others from the group');
    }

    await this.prisma.dMParticipant.update({
      where: {
        conversationId_userId: { conversationId, userId: targetId },
      },
      data: { leftAt: new Date() },
    });

    // If owner left, transfer ownership
    if (targetId === conversation.ownerId) {
      const remaining = conversation.participants.filter((p) => p.userId !== targetId);
      if (remaining.length > 0) {
        await this.prisma.dMConversation.update({
          where: { id: conversationId },
          data: { ownerId: remaining[0]!.userId },
        });
      }
    }

    this.eventEmitter.emit('dm.memberRemove', { conversationId, userId: targetId, removedBy: userId });
    return { message: 'Left conversation' };
  }

  async getDMConversations(userId: string) {
    const participations = await this.prisma.dMParticipant.findMany({
      where: { userId, leftAt: null },
      include: participationListInclude,
      orderBy: { conversation: { updatedAt: 'desc' } },
    });

    // Backfill Channel records for pre-existing DM conversations
    await Promise.all(
      participations.map((p: DMParticipationListRow) =>
        this.ensureChannelRecord(p.conversation.id, p.conversation.type, p.conversation.name ?? undefined),
      ),
    );

    return participations.map((p: DMParticipationListRow) => this.toDMPayload(p.conversation as DMConversationForPayload));
  }

  async getDMChannel(conversationId: string, userId: string) {
    const participation = await this.prisma.dMParticipant.findFirst({
      where: { conversationId, userId, leftAt: null },
    });

    if (!participation) throw new ForbiddenException('Not a participant in this conversation');

    const conversation = await this.prisma.dMConversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          where: { leftAt: null },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                discriminator: true,
                globalName: true,
                avatarId: true,
                flags: true,
              },
            },
          },
        },
      },
    });

    if (!conversation) throw new NotFoundException('Conversation not found');

    // Backfill Channel record for pre-existing DM conversations
    await this.ensureChannelRecord(conversationId, conversation.type as 'DM' | 'GROUP_DM', conversation.name ?? undefined);

    return this.toDMPayload(conversation);
  }

  async getDMMessages(conversationId: string, userId: string, options: {
    before?: string;
    after?: string;
    limit?: number;
  } = {}) {
    const participation = await this.prisma.dMParticipant.findFirst({
      where: { conversationId, userId, leftAt: null },
    });

    if (!participation) throw new ForbiddenException('Not a participant in this conversation');

    // Backfill Channel record for pre-existing DM conversations
    await this.ensureChannelRecord(conversationId, 'DM');

    const limit = Math.min(options.limit ?? 50, 100);

    const messages = await this.prisma.message.findMany({
      where: {
        channelId: conversationId,
        deletedAt: null,
        ...(options.before && { id: { lt: options.before } }),
        ...(options.after && { id: { gt: options.after } }),
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            discriminator: true,
            globalName: true,
            avatarId: true,
          },
        },
        attachments: true,
        reactions: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return messages.reverse().map((msg: DMChannelMessageRow) => mapMessageForClient(msg, userId));
  }
}
