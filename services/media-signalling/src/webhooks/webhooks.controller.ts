/**
 * LiveKit Webhook Handler
 *
 * LiveKit sends webhook events for room lifecycle changes.
 * We validate the signature, parse the event, and publish to Redis
 * so the gateway can broadcast VOICE_STATE_UPDATE to subscribed clients.
 *
 * Events we care about:
 * - participant_joined    → user joined voice channel
 * - participant_left      → user left voice channel
 * - track_published       → screen share / camera started
 * - track_unpublished     → screen share / camera stopped
 * - room_started          → room created
 * - room_finished         → room destroyed (all left)
 *
 * Published Redis channels follow the gateway topic convention:
 *   swiip:events:guild:{guildId} — so the gateway fans out to guild members
 */

import {
  Controller,
  Post,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiExcludeEndpoint } from '@nestjs/swagger';
import { WebhookReceiver } from 'livekit-server-sdk';
import { FastifyRequest } from 'fastify';
import Redis from 'ioredis';

/**
 * Voice state stored per-user in Redis for quick lookups.
 * Key: swiip:voice:user:{userId}
 */
interface VoiceState {
  userId: string;
  guildId: string;
  channelId: string;
  selfMute: boolean;
  selfDeaf: boolean;
  serverMute: boolean;
  serverDeaf: boolean;
  isScreenSharing: boolean;
  isVideoEnabled: boolean;
  speaking: boolean;
  joinedAt: number;
}

/**
 * Voice room state stored per-channel in Redis.
 * Key: swiip:voice:room:{guildId}:{channelId}
 */
interface RoomState {
  guildId: string;
  channelId: string;
  participantIds: string[];
  startedAt: number;
}

@ApiTags('Internal')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);
  private readonly receiver: WebhookReceiver;
  private readonly redis: Redis;

  /** TTL for voice state keys — auto-cleanup if webhook missed. */
  private static readonly VOICE_STATE_TTL = 3600; // 1 hour
  private static readonly ROOM_STATE_TTL = 3600;

  constructor(private readonly config: ConfigService) {
    this.receiver = new WebhookReceiver(
      this.config.getOrThrow('LIVEKIT_API_KEY'),
      this.config.getOrThrow('LIVEKIT_API_SECRET'),
    );

    this.redis = new Redis(
      this.config.get('REDIS_URL', 'redis://localhost:6379'),
      { maxRetriesPerRequest: 3, lazyConnect: false },
    );
    this.redis.on('error', (err) => this.logger.error('Redis error', err));
  }

  @Post('livekit')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async handleLiveKitWebhook(
    @Headers('authorization') authHeader: string,
    @Req() req: RawBodyRequest<FastifyRequest>,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) {
      this.logger.warn('LiveKit webhook: rawBody is not available — ensure rawBody is enabled');
      return { ok: false };
    }

    let event: any;
    try {
      event = await this.receiver.receive(rawBody.toString(), authHeader);
    } catch (err) {
      this.logger.warn('Invalid LiveKit webhook signature');
      return { ok: false };
    }

    this.logger.log(`LiveKit event: ${event.event}`);

    switch (event.event) {
      case 'participant_joined':
        await this.onParticipantJoined(event);
        break;
      case 'participant_left':
        await this.onParticipantLeft(event);
        break;
      case 'track_published':
        await this.onTrackPublished(event);
        break;
      case 'track_unpublished':
        await this.onTrackUnpublished(event);
        break;
      case 'room_finished':
        await this.onRoomFinished(event);
        break;
      default:
        break;
    }

    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  private async onParticipantJoined(event: any): Promise<void> {
    const { room, participant } = event;
    const { guildId, channelId } = this.parseRoomName(room.name);
    if (!guildId || !channelId) return;

    const userId = participant.identity as string;
    this.logger.log(`Participant ${userId} joined ${room.name}`);

    // Store voice state in Redis
    const voiceState: VoiceState = {
      userId,
      guildId,
      channelId,
      selfMute: false,
      selfDeaf: false,
      serverMute: false,
      serverDeaf: false,
      isScreenSharing: false,
      isVideoEnabled: false,
      speaking: false,
      joinedAt: Date.now(),
    };

    const pipeline = this.redis.pipeline();

    // Per-user voice state
    const userKey = `swiip:voice:user:${userId}`;
    pipeline.hset(userKey, this.serializeVoiceState(voiceState));
    pipeline.expire(userKey, WebhooksController.VOICE_STATE_TTL);

    // Per-room participant set
    const roomKey = `swiip:voice:room:${guildId}:${channelId}`;
    pipeline.sadd(roomKey, userId);
    pipeline.expire(roomKey, WebhooksController.ROOM_STATE_TTL);

    await pipeline.exec();

    // Publish VOICE_STATE_UPDATE to the guild topic via gateway pub/sub
    await this.publishVoiceStateUpdate(guildId, {
      userId,
      channelId,
      guildId,
      selfMute: false,
      selfDeaf: false,
      serverMute: false,
      serverDeaf: false,
      speaking: false,
    });
  }

  private async onParticipantLeft(event: any): Promise<void> {
    const { room, participant } = event;
    const { guildId, channelId } = this.parseRoomName(room.name);
    if (!guildId || !channelId) return;

    const userId = participant.identity as string;
    this.logger.log(`Participant ${userId} left ${room.name}`);

    const pipeline = this.redis.pipeline();
    pipeline.del(`swiip:voice:user:${userId}`);
    pipeline.srem(`swiip:voice:room:${guildId}:${channelId}`, userId);
    await pipeline.exec();

    // channelId: null signals "left voice"
    await this.publishVoiceStateUpdate(guildId, {
      userId,
      channelId: null,
      guildId,
      selfMute: false,
      selfDeaf: false,
      serverMute: false,
      serverDeaf: false,
      speaking: false,
    });
  }

  private async onTrackPublished(event: any): Promise<void> {
    const { room, participant, track } = event;
    const { guildId, channelId } = this.parseRoomName(room.name);
    if (!guildId || !channelId) return;

    const userId = participant.identity as string;
    const source = track?.source as string;

    if (source === 'SCREEN_SHARE' || source === 'SCREEN_SHARE_AUDIO') {
      this.logger.log(`Screen share started by ${userId} in ${room.name}`);
      await this.redis.hset(`swiip:voice:user:${userId}`, 'isScreenSharing', 'true');
    } else if (source === 'CAMERA') {
      await this.redis.hset(`swiip:voice:user:${userId}`, 'isVideoEnabled', 'true');
    }

    // Re-read full state and broadcast
    await this.broadcastCurrentState(userId, guildId, channelId);
  }

  private async onTrackUnpublished(event: any): Promise<void> {
    const { room, participant, track } = event;
    const { guildId, channelId } = this.parseRoomName(room.name);
    if (!guildId || !channelId) return;

    const userId = participant.identity as string;
    const source = track?.source as string;

    if (source === 'SCREEN_SHARE' || source === 'SCREEN_SHARE_AUDIO') {
      this.logger.log(`Screen share ended by ${userId} in ${room.name}`);
      await this.redis.hset(`swiip:voice:user:${userId}`, 'isScreenSharing', 'false');
    } else if (source === 'CAMERA') {
      await this.redis.hset(`swiip:voice:user:${userId}`, 'isVideoEnabled', 'false');
    }

    await this.broadcastCurrentState(userId, guildId, channelId);
  }

  private async onRoomFinished(event: any): Promise<void> {
    const { room } = event;
    const { guildId, channelId } = this.parseRoomName(room.name);
    if (!guildId || !channelId) return;

    this.logger.log(`Room finished: ${room.name}`);

    // Clean up all participants in this room
    const roomKey = `swiip:voice:room:${guildId}:${channelId}`;
    const members = await this.redis.smembers(roomKey);

    if (members.length > 0) {
      const pipeline = this.redis.pipeline();
      for (const userId of members) {
        pipeline.del(`swiip:voice:user:${userId}`);
      }
      pipeline.del(roomKey);
      await pipeline.exec();

      // Notify clients that all participants have left
      for (const userId of members) {
        await this.publishVoiceStateUpdate(guildId, {
          userId,
          channelId: null,
          guildId,
          selfMute: false,
          selfDeaf: false,
          serverMute: false,
          serverDeaf: false,
          speaking: false,
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Redis pub/sub → Gateway
  // ---------------------------------------------------------------------------

  /**
   * Publishes a VOICE_STATE_UPDATE event to the gateway's pub/sub channel.
   * The gateway's SubscriptionManager fans this out to all guild members.
   */
  private async publishVoiceStateUpdate(
    guildId: string,
    voiceState: {
      userId: string;
      channelId: string | null;
      guildId: string;
      selfMute: boolean;
      selfDeaf: boolean;
      serverMute: boolean;
      serverDeaf: boolean;
      speaking: boolean;
    },
  ): Promise<void> {
    const topic = `guild:${guildId}`;
    const event = {
      op: 0, // DISPATCH
      t: 'VOICE_STATE_UPDATE',
      d: voiceState,
      s: 0,
    };

    const message = JSON.stringify({ topic, event });
    const channel = `swiip:events:${topic}`;

    try {
      await this.redis.publish(channel, message);

      // Also write to the guild stream for replay on RESUME
      await this.redis.xadd(
        `swiip:stream:${topic}`,
        'MAXLEN', '~', '1000',
        '*',
        'type', 'VOICE_STATE_UPDATE',
        'data', JSON.stringify(event),
        'ts', String(Date.now()),
      );
    } catch (err) {
      this.logger.error(`Failed to publish voice state for ${voiceState.userId}`, err);
    }
  }

  /**
   * Reads the current voice state from Redis and broadcasts it.
   */
  private async broadcastCurrentState(
    userId: string,
    guildId: string,
    channelId: string,
  ): Promise<void> {
    const raw = await this.redis.hgetall(`swiip:voice:user:${userId}`);
    if (!raw || !raw['userId']) return;

    await this.publishVoiceStateUpdate(guildId, {
      userId: raw['userId']!,
      channelId,
      guildId,
      selfMute: raw['selfMute'] === 'true',
      selfDeaf: raw['selfDeaf'] === 'true',
      serverMute: raw['serverMute'] === 'true',
      serverDeaf: raw['serverDeaf'] === 'true',
      speaking: raw['speaking'] === 'true',
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private parseRoomName(roomName: string): { guildId: string | null; channelId: string | null } {
    const match = roomName.match(/^guild-([^-]+)-(.+)$/);
    if (!match) return { guildId: null, channelId: null };
    return { guildId: match[1] ?? null, channelId: match[2] ?? null };
  }

  private serializeVoiceState(vs: VoiceState): Record<string, string> {
    return {
      userId: vs.userId,
      guildId: vs.guildId,
      channelId: vs.channelId,
      selfMute: String(vs.selfMute),
      selfDeaf: String(vs.selfDeaf),
      serverMute: String(vs.serverMute),
      serverDeaf: String(vs.serverDeaf),
      isScreenSharing: String(vs.isScreenSharing),
      isVideoEnabled: String(vs.isVideoEnabled),
      speaking: String(vs.speaking),
      joinedAt: String(vs.joinedAt),
    };
  }
}
