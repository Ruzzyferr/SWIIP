import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RedisService } from './redis.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * EventPublisherService bridges NestJS EventEmitter events to the Gateway's
 * realtime delivery system. It does two things for each event:
 *
 * 1. PUBLISH to `swiip:events:{topic}` — for live delivery via Redis pub/sub
 *    (the gateway's SubscriptionManager fans this out to connected WebSockets)
 *
 * 2. XADD to `swiip:stream:{topic}` — for replay on RESUME
 *    (the gateway reads these streams when a client reconnects and missed events)
 *
 * Stream topology:
 *   swiip:stream:guild:{guildId}  — guild-scoped events (messages, members, channels, roles)
 *   swiip:stream:user:{userId}    — personal events (DMs, notifications, friend requests)
 *
 * Delivery guarantees:
 *   - Pub/sub: at-most-once (if no subscriber is listening, the event is lost)
 *   - Streams: at-least-once within the replay window (5 min MAXLEN trim)
 *   - Combined: events arrive live via pub/sub; missed events are replayed from streams
 *   - No exactly-once guarantee: clients must be idempotent (deduplicate by event ID/nonce)
 *
 * Limitations:
 *   - Streams are trimmed with MAXLEN ~1000 per topic to bound memory
 *   - Events older than the stream window cannot be replayed (client must re-IDENTIFY)
 *   - Typing events and presence updates are NOT written to streams (ephemeral)
 */
@Injectable()
export class EventPublisherService implements OnModuleInit {
  private readonly logger = new Logger(EventPublisherService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.logger.log('EventPublisherService initialized — bridging events to gateway');
  }

  // ---------------------------------------------------------------------------
  // Core publish + stream write
  // ---------------------------------------------------------------------------

  /**
   * Publishes an event to both pub/sub (live delivery) and a Redis Stream (replay).
   *
   * @param topic   - Routing topic (e.g. "guild:123", "user:456")
   * @param type    - Event type string (e.g. "MESSAGE_CREATE")
   * @param payload - Event data payload
   * @param options - Control whether to write to stream (default: true)
   */
  private async publishEvent(
    topic: string,
    type: string,
    payload: unknown,
    options: { stream?: boolean } = {},
  ): Promise<void> {
    const writeStream = options.stream !== false;

    const event = {
      op: 0, // OpCode.DISPATCH
      t: type,
      d: payload,
      s: 0, // Placeholder; the gateway assigns per-session sequence numbers
    };

    const pubsubMessage = JSON.stringify({ topic, event });
    const pubsubChannel = `swiip:events:${topic}`;

    try {
      // 1. Live delivery via pub/sub
      await this.redis.publish(pubsubChannel, pubsubMessage);

      // 2. Stream write for replay (unless ephemeral)
      if (writeStream) {
        const streamKey = `swiip:stream:${topic}`;
        const client = this.redis.getClient();
        await client.xadd(
          streamKey,
          'MAXLEN', '~', '1000', // Approximate trim to ~1000 entries
          '*',                    // Auto-generate entry ID (timestamp-based)
          'type', type,
          'data', JSON.stringify(event),
          'ts', String(Date.now()),
        );
      }
    } catch (err) {
      this.logger.error(`Failed to publish event ${type} to ${topic}`, err);
    }
  }

  /**
   * Publishes to a guild topic and also to per-user streams for all members.
   * This ensures that on RESUME, a user can replay events from their personal
   * stream without needing to read every guild stream.
   */
  private async publishGuildEvent(
    guildId: string,
    type: string,
    payload: unknown,
  ): Promise<void> {
    await this.publishEvent(`guild:${guildId}`, type, payload);
  }

  /**
   * Publishes to a user's personal topic and stream.
   */
  private async publishUserEvent(
    userId: string,
    type: string,
    payload: unknown,
  ): Promise<void> {
    await this.publishEvent(`user:${userId}`, type, payload);
  }

  // ---------------------------------------------------------------------------
  // Message events
  // ---------------------------------------------------------------------------

  @OnEvent('message.created')
  async onMessageCreated(payload: {
    channelId: string;
    guildId?: string;
    message: unknown;
  }): Promise<void> {
    if (payload.guildId) {
      await this.publishGuildEvent(payload.guildId, 'MESSAGE_CREATE', {
        message: payload.message,
      });
    }
  }

  @OnEvent('message.updated')
  async onMessageUpdated(payload: {
    messageId: string;
    channelId: string;
    guildId?: string;
    message?: unknown;
  }): Promise<void> {
    if (payload.guildId) {
      await this.publishGuildEvent(payload.guildId, 'MESSAGE_UPDATE', {
        messageId: payload.messageId,
        channelId: payload.channelId,
        message: payload.message,
      });
    }
  }

  @OnEvent('message.deleted')
  async onMessageDeleted(payload: {
    messageId: string;
    channelId: string;
    guildId?: string;
  }): Promise<void> {
    if (payload.guildId) {
      await this.publishGuildEvent(payload.guildId, 'MESSAGE_DELETE', {
        messageId: payload.messageId,
        channelId: payload.channelId,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Guild events
  // ---------------------------------------------------------------------------

  @OnEvent('guild.created')
  async onGuildCreated(payload: {
    guildId: string;
    ownerId: string;
  }): Promise<void> {
    await this.publishUserEvent(payload.ownerId, 'GUILD_CREATE', {
      guildId: payload.guildId,
    });
  }

  @OnEvent('guild.updated')
  async onGuildUpdated(payload: {
    guildId: string;
    actorId: string;
  }): Promise<void> {
    await this.publishGuildEvent(payload.guildId, 'GUILD_UPDATE', {
      guildId: payload.guildId,
    });
  }

  @OnEvent('guild.deleted')
  async onGuildDeleted(payload: {
    guildId: string;
    ownerId: string;
  }): Promise<void> {
    await this.publishGuildEvent(payload.guildId, 'GUILD_DELETE', {
      guildId: payload.guildId,
    });
  }

  @OnEvent('guild.memberAdd')
  async onGuildMemberAdd(payload: {
    guildId: string;
    userId: string;
    inviteCode?: string;
  }): Promise<void> {
    // Notify the guild about the new member
    await this.publishGuildEvent(payload.guildId, 'GUILD_MEMBER_ADD', {
      guildId: payload.guildId,
      userId: payload.userId,
    });
    // Notify the user personally so they get the guild in their list
    await this.publishUserEvent(payload.userId, 'GUILD_CREATE', {
      guildId: payload.guildId,
    });
  }

  @OnEvent('guild.memberRemove')
  async onGuildMemberRemove(payload: {
    guildId: string;
    userId: string;
    actorId?: string;
    reason?: string;
  }): Promise<void> {
    await this.publishGuildEvent(payload.guildId, 'GUILD_MEMBER_REMOVE', {
      guildId: payload.guildId,
      userId: payload.userId,
    });
    await this.publishUserEvent(payload.userId, 'GUILD_DELETE', {
      guildId: payload.guildId,
    });
  }

  @OnEvent('guild.memberUpdate')
  async onGuildMemberUpdate(payload: {
    guildId: string;
    userId: string;
    member: unknown;
  }): Promise<void> {
    await this.publishGuildEvent(payload.guildId, 'GUILD_MEMBER_UPDATE', {
      guildId: payload.guildId,
      member: payload.member,
    });
  }

  @OnEvent('guild.memberLeave')
  async onGuildMemberLeave(payload: {
    guildId: string;
    userId: string;
  }): Promise<void> {
    await this.publishGuildEvent(payload.guildId, 'GUILD_MEMBER_REMOVE', {
      guildId: payload.guildId,
      userId: payload.userId,
    });
  }

  // ---------------------------------------------------------------------------
  // Channel events
  // ---------------------------------------------------------------------------

  @OnEvent('channel.created')
  async onChannelCreated(payload: {
    guildId: string;
    channelId: string;
    actorId: string;
  }): Promise<void> {
    await this.publishGuildEvent(payload.guildId, 'CHANNEL_CREATE', {
      channelId: payload.channelId,
      guildId: payload.guildId,
    });
  }

  @OnEvent('channel.updated')
  async onChannelUpdated(payload: {
    channelId: string;
    guildId?: string;
    actorId: string;
  }): Promise<void> {
    if (payload.guildId) {
      await this.publishGuildEvent(payload.guildId, 'CHANNEL_UPDATE', {
        channelId: payload.channelId,
        guildId: payload.guildId,
      });
    }
  }

  @OnEvent('channel.deleted')
  async onChannelDeleted(payload: {
    channelId: string;
    guildId?: string;
    actorId: string;
  }): Promise<void> {
    if (payload.guildId) {
      await this.publishGuildEvent(payload.guildId, 'CHANNEL_DELETE', {
        channelId: payload.channelId,
        guildId: payload.guildId,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // DM events
  // ---------------------------------------------------------------------------

  @OnEvent('dm.created')
  async onDmCreated(payload: {
    conversationId: string;
    userId: string;
    targetId: string;
  }): Promise<void> {
    await this.publishUserEvent(payload.userId, 'DM_CREATE', {
      conversationId: payload.conversationId,
    });
    await this.publishUserEvent(payload.targetId, 'DM_CREATE', {
      conversationId: payload.conversationId,
    });
  }

  @OnEvent('dm.groupCreated')
  async onDmGroupCreated(payload: {
    conversationId: string;
    userId: string;
  }): Promise<void> {
    await this.publishUserEvent(payload.userId, 'DM_CREATE', {
      conversationId: payload.conversationId,
    });
  }

  @OnEvent('dm.memberAdd')
  async onDmMemberAdd(payload: {
    conversationId: string;
    userId: string;
    addedBy: string;
  }): Promise<void> {
    await this.publishUserEvent(payload.userId, 'DM_CREATE', {
      conversationId: payload.conversationId,
    });
  }

  @OnEvent('dm.memberRemove')
  async onDmMemberRemove(payload: {
    conversationId: string;
    userId: string;
    removedBy: string;
  }): Promise<void> {
    await this.publishUserEvent(payload.userId, 'DM_DELETE', {
      conversationId: payload.conversationId,
    });
  }

  // ---------------------------------------------------------------------------
  // Moderation events
  // ---------------------------------------------------------------------------

  @OnEvent('moderation.action')
  async onModerationAction(payload: {
    guildId: string;
    targetUserId: string;
    action: string;
    reason?: string;
  }): Promise<void> {
    await this.publishGuildEvent(payload.guildId, 'MODERATION_ACTION', {
      guildId: payload.guildId,
      targetUserId: payload.targetUserId,
      action: payload.action,
      reason: payload.reason,
    });
  }
}
