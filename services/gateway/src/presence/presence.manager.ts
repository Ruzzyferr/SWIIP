import type { Redis as RedisClient } from 'ioredis';
import type { RedisPubSub } from '../redis/redis.pubsub';
import { OpCode, ServerEventType, type PresenceStatus, type ActivityPayload } from '@constchat/protocol';
import { createComponentLogger } from '../utils/logger';

const log = createComponentLogger('presence-manager');

/** How long (ms) before a presence entry is treated as expired (offline). */
const PRESENCE_TTL_SECONDS = 90;

export interface PresenceData {
  userId: string;
  status: PresenceStatus;
  customStatus?: string;
  activities?: ActivityPayload[];
  /** Unix ms timestamp of last update. */
  updatedAt: number;
}

export class PresenceManager {
  private readonly redis: RedisClient;
  private readonly pubsub: RedisPubSub;

  constructor(redis: RedisClient, pubsub: RedisPubSub) {
    this.redis = redis;
    this.pubsub = pubsub;
  }

  /**
   * Writes presence for a user to Redis and broadcasts a PRESENCE_UPDATE event
   * to all guilds the user belongs to.
   */
  async updatePresence(
    userId: string,
    status: PresenceStatus,
    guildIds: string[],
    customStatus?: string,
    activities?: ActivityPayload[],
  ): Promise<void> {
    const key = `swiip:presence:${userId}`;
    const data: PresenceData = {
      userId,
      status,
      customStatus,
      activities,
      updatedAt: Date.now(),
    };

    const pipeline = this.redis.pipeline();
    pipeline.hset(key, {
      userId,
      status,
      customStatus: customStatus ?? '',
      activities: JSON.stringify(activities ?? []),
      updatedAt: String(data.updatedAt),
    });
    pipeline.expire(key, PRESENCE_TTL_SECONDS);
    await pipeline.exec();

    // Broadcast to each guild the user belongs to
    const event = {
      op: OpCode.DISPATCH,
      t: ServerEventType.PRESENCE_UPDATE,
      d: {
        userId,
        status,
        customStatus,
        activities,
      },
      s: 0,
    };

    const broadcastPromises = guildIds.map((guildId) =>
      this.pubsub.publish(`guild:${guildId}`, event).catch((err) =>
        log.error({ err, guildId, userId }, 'Failed to publish presence update'),
      ),
    );
    await Promise.all(broadcastPromises);
  }

  /**
   * Reads presence for a single user from Redis.
   * Returns null if not found or TTL has expired (treat as offline).
   */
  async getPresence(userId: string): Promise<PresenceData | null> {
    const key = `swiip:presence:${userId}`;
    const raw = await this.redis.hgetall(key);
    if (!raw || !raw['status']) return null;
    return this.deserializePresence(raw);
  }

  /**
   * Fetches presence for multiple users in a single pipeline.
   * Missing entries are returned as offline stubs.
   */
  async bulkGetPresence(userIds: string[]): Promise<Map<string, PresenceData>> {
    if (userIds.length === 0) return new Map();

    const pipeline = this.redis.pipeline();
    for (const userId of userIds) {
      pipeline.hgetall(`swiip:presence:${userId}`);
    }

    const results = await pipeline.exec();
    const out = new Map<string, PresenceData>();

    if (!results) return out;

    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i]!;
      const [err, raw] = results[i] as [Error | null, Record<string, string>];
      if (err || !raw || !raw['status']) {
        out.set(userId, {
          userId,
          status: 'offline',
          updatedAt: 0,
        });
      } else {
        out.set(userId, this.deserializePresence(raw));
      }
    }

    return out;
  }

  /**
   * Called when a user's session connects.
   * Restores persisted status or defaults to 'online'.
   */
  async onConnect(
    userId: string,
    sessionId: string,
    guildIds: string[],
    preferredStatus?: PresenceStatus,
  ): Promise<void> {
    // Add sessionId to user's session set
    const sessionsKey = `swiip:user_sessions:${userId}`;
    await this.redis.sadd(sessionsKey, sessionId);
    // sessions key should outlive individual session TTL
    await this.redis.expire(sessionsKey, 86_400);

    // Check if any other session is already online
    const currentPresence = await this.getPresence(userId);
    if (!currentPresence || currentPresence.status === 'offline') {
      const status = preferredStatus ?? 'online';
      // Invisible users broadcast as offline to others
      const broadcastStatus = status === 'invisible' ? 'offline' : status;
      await this.updatePresence(userId, broadcastStatus, guildIds);
      if (status === 'invisible') {
        await this.setActualStatus(userId, 'invisible');
      }
    } else {
      // Just refresh the TTL
      await this.redis.expire(`swiip:presence:${userId}`, PRESENCE_TTL_SECONDS);
    }

    log.debug({ userId, sessionId }, 'User connected');
  }

  /**
   * Called when a session disconnects.
   * If this was the user's last active session, marks them offline.
   */
  async onDisconnect(userId: string, sessionId: string, guildIds: string[]): Promise<void> {
    const sessionsKey = `swiip:user_sessions:${userId}`;
    // Atomic srem + scard to avoid TOCTOU race in multi-instance deployments
    const remainingSessions = await this.redis.eval(
      'redis.call("srem", KEYS[1], ARGV[1]); return redis.call("scard", KEYS[1])',
      1,
      sessionsKey,
      sessionId,
    ) as number;
    if (remainingSessions === 0) {
      await this.updatePresence(userId, 'offline', guildIds);
      log.debug({ userId, sessionId }, 'User went offline (last session)');
    } else {
      log.debug({ userId, sessionId, remainingSessions }, 'Session closed, user still online');
    }
  }

  /**
   * Refreshes the presence TTL (called on each heartbeat ACK).
   */
  async refreshTTL(userId: string): Promise<void> {
    const key = `swiip:presence:${userId}`;
    await this.redis.expire(key, PRESENCE_TTL_SECONDS);
    // Also refresh actual status TTL if it exists (invisible users)
    await this.redis.expire(`swiip:presence:actual:${userId}`, PRESENCE_TTL_SECONDS);
  }

  /**
   * Stores the user's actual status (e.g. 'invisible') separately from the broadcast status.
   * This allows the user's own client to know they're invisible while others see 'offline'.
   */
  async setActualStatus(userId: string, status: PresenceStatus): Promise<void> {
    await this.redis.set(`swiip:presence:actual:${userId}`, status, 'EX', PRESENCE_TTL_SECONDS);
  }

  /**
   * Gets the user's actual status (checks invisible override first, falls back to presence).
   */
  async getActualStatus(userId: string): Promise<PresenceStatus> {
    const actual = await this.redis.get(`swiip:presence:actual:${userId}`);
    if (actual) return actual as PresenceStatus;
    const presence = await this.getPresence(userId);
    return presence?.status ?? 'offline';
  }

  /**
   * Sends the current presence of all visible guild members to a newly-subscribed connection.
   * Used when a client subscribes to a guild's presence data.
   */
  async sendGuildPresenceBulk(
    memberIds: string[],
  ): Promise<Map<string, PresenceData>> {
    return this.bulkGetPresence(memberIds);
  }

  private deserializePresence(raw: Record<string, string>): PresenceData {
    let activities: ActivityPayload[] | undefined;
    try {
      activities = raw['activities'] ? (JSON.parse(raw['activities']) as ActivityPayload[]) : undefined;
    } catch {
      activities = [];
    }

    return {
      userId: raw['userId'] ?? '',
      status: (raw['status'] as PresenceStatus) ?? 'offline',
      customStatus: raw['customStatus'] || undefined,
      activities: activities && activities.length > 0 ? activities : undefined,
      updatedAt: raw['updatedAt'] ? parseInt(raw['updatedAt'], 10) : 0,
    };
  }
}
