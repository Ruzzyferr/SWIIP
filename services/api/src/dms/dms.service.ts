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

@Injectable()
export class DMsService {
  private readonly logger = new Logger(DMsService.name);
  private readonly MAX_GROUP_DM_MEMBERS = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

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
      const participantIds = existingConversation.participants.map((p: any) => p.userId);
      if (participantIds.includes(userId) && participantIds.includes(targetId)) {
        return existingConversation;
      }
    }

    // Create new DM conversation
    const conversation = await this.prisma.dMConversation.create({
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

    this.logger.log(`DM created between ${userId} and ${targetId}`);
    this.eventEmitter.emit('dm.created', { conversationId: conversation.id, userId, targetId });

    return conversation;
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

    const conversation = await this.prisma.dMConversation.create({
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

    this.logger.log(`Group DM created by ${userId} with ${uniqueIds.length} members`);
    this.eventEmitter.emit('dm.groupCreated', { conversationId: conversation.id, userId });

    return conversation;
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

    const isParticipant = conversation.participants.some((p: any) => p.userId === userId);
    if (!isParticipant) throw new ForbiddenException('Not a participant in this conversation');

    const activeParticipantCount = conversation.participants.length;
    if (activeParticipantCount >= this.MAX_GROUP_DM_MEMBERS) {
      throw new BadRequestException(`Group DMs are limited to ${this.MAX_GROUP_DM_MEMBERS} members`);
    }

    const alreadyMember = conversation.participants.some((p: any) => p.userId === targetId);
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
      const remaining = conversation.participants.filter(
        (p: any) => p.userId !== targetId,
      );
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
      include: {
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
      },
      orderBy: { conversation: { updatedAt: 'desc' } },
    });

    return participations.map((p: any) => {
      const conv = p.conversation;
      const otherParticipants = conv.participants.filter((part: any) => part.userId !== userId);

      return {
        id: conv.id,
        type: conv.type,
        name: conv.type === 'DM' ? otherParticipants[0]?.user.globalName ?? otherParticipants[0]?.user.username : conv.name,
        icon: conv.icon,
        lastMessageId: conv.lastMessageId,
        participants: conv.participants,
        updatedAt: conv.updatedAt,
        createdAt: conv.createdAt,
      };
    });
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
    return conversation;
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

    const limit = Math.min(options.limit ?? 50, 100);

    return this.prisma.message.findMany({
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
  }
}
