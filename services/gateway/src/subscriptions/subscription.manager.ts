import type { Redis as RedisClient } from 'ioredis';
import type { RedisPubSub, PubSubMessage } from '../redis/redis.pubsub';
import type { UWSWebSocket } from '../types';
import { createComponentLogger } from '../utils/logger';
import { OpCode } from '@constchat/protocol';

const log = createComponentLogger('subscription-manager');

/**
 * SubscriptionManager maps topics to the set of WebSocket connections
 * currently interested in that topic.
 *
 * Topics follow the pattern:
 *   guild:{id}    – all events for a guild (messages, members, etc.)
 *   channel:{id}  – channel-scoped events (typing, pins)
 *   dm:{id}       – DM/Group DM events
 *   user:{id}     – personal events (friend requests, notifications)
 *
 * The manager registers a single global handler on RedisPubSub so that every
 * inbound event is examined once and forwarded to all matching local sessions.
 * This avoids the N×M problem of registering one Redis handler per topic.
 */
export class SubscriptionManager {
  /** topic → set of sessionIds */
  private readonly topicSessions = new Map<string, Set<string>>();
  /** sessionId → set of topics */
  private readonly sessionTopics = new Map<string, Set<string>>();
  /** sessionId → WebSocket reference */
  private readonly sessionSockets = new Map<string, UWSWebSocket>();

  private readonly redis: RedisClient;
  private readonly pubsub: RedisPubSub;

  constructor(redis: RedisClient, pubsub: RedisPubSub) {
    this.redis = redis;
    this.pubsub = pubsub;

    // Register a single catch-all handler for all incoming Redis messages.
    // This handler dispatches to local sessions based on their topic subscriptions.
    this.pubsub.subscribeGlobal(this.onRedisMessage.bind(this));
  }

  /**
   * Registers a WebSocket connection with its session.
   */
  registerSession(sessionId: string, ws: UWSWebSocket): void {
    this.sessionSockets.set(sessionId, ws);
    this.sessionTopics.set(sessionId, new Set());
    log.debug({ sessionId }, 'Session registered');
  }

  /**
   * Subscribes a session to a topic.
   * Idempotent – safe to call multiple times.
   */
  subscribe(sessionId: string, topic: string): void {
    let sessions = this.topicSessions.get(topic);
    if (!sessions) {
      sessions = new Set();
      this.topicSessions.set(topic, sessions);
    }
    sessions.add(sessionId);

    const topics = this.sessionTopics.get(sessionId);
    if (topics) {
      topics.add(topic);
    }

    log.debug({ sessionId, topic }, 'Subscribed to topic');
  }

  /**
   * Unsubscribes a session from a specific topic.
   */
  unsubscribe(sessionId: string, topic: string): void {
    const sessions = this.topicSessions.get(topic);
    if (sessions) {
      sessions.delete(sessionId);
      if (sessions.size === 0) {
        this.topicSessions.delete(topic);
      }
    }
    const topics = this.sessionTopics.get(sessionId);
    if (topics) {
      topics.delete(topic);
    }
    log.debug({ sessionId, topic }, 'Unsubscribed from topic');
  }

  /**
   * Removes all subscriptions for a session (called on disconnect).
   */
  removeSession(sessionId: string): void {
    const topics = this.sessionTopics.get(sessionId);
    if (topics) {
      for (const topic of topics) {
        const sessions = this.topicSessions.get(topic);
        if (sessions) {
          sessions.delete(sessionId);
          if (sessions.size === 0) {
            this.topicSessions.delete(topic);
          }
        }
      }
      this.sessionTopics.delete(sessionId);
    }
    this.sessionSockets.delete(sessionId);
    log.debug({ sessionId }, 'Session removed from subscription manager');
  }

  /**
   * Broadcasts a pre-serialized string to all sessions subscribed to a topic.
   * Returns the number of connections the message was sent to.
   */
  broadcast(topic: string, serialized: string): number {
    const sessions = this.topicSessions.get(topic);
    if (!sessions || sessions.size === 0) return 0;

    let sent = 0;
    for (const sessionId of sessions) {
      const ws = this.sessionSockets.get(sessionId);
      if (!ws) continue;
      try {
        const result = ws.send(serialized);
        if (result === 0) {
          // Backpressure: message is buffered by uWS, will be sent on drain
          log.debug({ sessionId, topic }, 'Message buffered due to backpressure');
          sent++;
        } else if (result === -1) {
          log.warn({ sessionId, topic }, 'Send failed: socket backpressure full, message dropped');
        } else {
          sent++;
        }
      } catch (err) {
        log.error({ err, sessionId, topic }, 'Error sending to session');
      }
    }
    return sent;
  }

  /**
   * Sends a message directly to a single session.
   */
  sendToSession(sessionId: string, serialized: string): boolean {
    const ws = this.sessionSockets.get(sessionId);
    if (!ws) return false;
    const result = ws.send(serialized);
    return result !== -1;
  }

  /**
   * Sends a message to all sessions belonging to a user (fan-out across devices).
   */
  async sendToUser(userId: string, serialized: string): Promise<void> {
    const sessionIds = await this.getSessionsForUser(userId);
    for (const sessionId of sessionIds) {
      this.sendToSession(sessionId, serialized);
    }
  }

  /**
   * Returns all active sessionIds for a user from Redis.
   */
  async getSessionsForUser(userId: string): Promise<string[]> {
    const key = `swiip:user_sessions:${userId}`;
    return this.redis.smembers(key);
  }

  /**
   * Returns all session IDs currently subscribed to a guild topic.
   */
  getSessionsForGuild(guildId: string): string[] {
    const topic = `guild:${guildId}`;
    return [...(this.topicSessions.get(topic) ?? [])];
  }

  /**
   * Returns all topics a session is subscribed to.
   */
  getSessionTopics(sessionId: string): string[] {
    return [...(this.sessionTopics.get(sessionId) ?? [])];
  }

  /**
   * Returns the WebSocket handle for a session, if registered.
   */
  getSessionSocket(sessionId: string): UWSWebSocket | undefined {
    return this.sessionSockets.get(sessionId);
  }

  /**
   * Total number of active local subscriptions (for metrics).
   */
  get totalSubscriptions(): number {
    let total = 0;
    for (const sessions of this.topicSessions.values()) {
      total += sessions.size;
    }
    return total;
  }

  /**
   * Total number of registered sessions (for metrics).
   */
  get connectedSessions(): number {
    return this.sessionSockets.size;
  }

  /**
   * Global handler: receives ALL inbound Redis pub/sub messages and routes
   * them to local WebSocket connections that are subscribed to the topic.
   */
  private onRedisMessage(msg: PubSubMessage): void {
    const { topic, event } = msg;

    const sessions = this.topicSessions.get(topic);
    if (!sessions || sessions.size === 0) return;

    if (event.op === OpCode.DISPATCH) {
      // Serialize the base payload once, then inject per-session sequence number.
      // This avoids O(N) JSON.stringify for N subscribers.
      const base = JSON.stringify({ op: event.op, t: event.t, d: event.d, s: 0 });
      // The trailing `"s":0}` is a stable suffix we can replace cheaply.
      const prefix = base.slice(0, -2); // everything before `0}`

      for (const sessionId of sessions) {
        const ws = this.sessionSockets.get(sessionId);
        if (!ws) continue;
        try {
          const userData = ws.getUserData();
          if (userData) {
            userData.sequence += 1;
            ws.send(prefix + userData.sequence + '}');
          }
        } catch (err) {
          log.error({ err, sessionId, topic }, 'Failed to forward Redis event to client');
        }
      }
    } else {
      // Non-DISPATCH: serialize once and broadcast the same string.
      const serialized = JSON.stringify({ op: event.op, t: event.t, d: event.d });
      for (const sessionId of sessions) {
        const ws = this.sessionSockets.get(sessionId);
        if (!ws) continue;
        try {
          ws.send(serialized);
        } catch (err) {
          log.error({ err, sessionId, topic }, 'Failed to forward Redis event to client');
        }
      }
    }
  }
}
