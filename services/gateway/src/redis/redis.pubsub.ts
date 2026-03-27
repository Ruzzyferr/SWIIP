import Redis, { type Redis as RedisClient } from 'ioredis';
import { createComponentLogger } from '../utils/logger';
import type { GatewayEvent } from '@constchat/protocol';

const log = createComponentLogger('redis-pubsub');

export interface PubSubMessage {
  topic: string;
  event: GatewayEvent;
}

export type TopicHandler = (message: PubSubMessage) => void;

/**
 * Manages Redis Pub/Sub for the gateway using two dedicated connections:
 * one for publishing (read/write) and one exclusively for subscribing.
 *
 * All gateway events are published on channels prefixed with:
 *   swiip:events:{topic}
 *
 * The subscriber listens with psubscribe on "swiip:events:*".
 */
export class RedisPubSub {
  private readonly publisher: RedisClient;
  private readonly subscriber: RedisClient;
  private readonly handlers = new Map<string, Set<TopicHandler>>();
  /** Handlers registered to receive every message regardless of topic. */
  private readonly globalHandlers = new Set<TopicHandler>();
  private isSubscribed = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;

  constructor(redisUrl: string) {
    const redisOptions = {
      lazyConnect: true,
      retryStrategy: (times: number) => {
        if (times > this.maxReconnectAttempts) {
          log.error({ times }, 'Redis max reconnect attempts reached');
          return null;
        }
        const delay = Math.min(times * 200, 5_000);
        log.warn({ times, delay }, 'Redis reconnecting');
        return delay;
      },
      reconnectOnError: (err: Error) => {
        const targetErrors = ['READONLY', 'ECONNRESET'];
        return targetErrors.some((e) => err.message.includes(e));
      },
    };

    this.publisher = new Redis(redisUrl, { ...redisOptions, connectionName: 'gateway-pub' });
    this.subscriber = new Redis(redisUrl, { ...redisOptions, connectionName: 'gateway-sub' });

    this.subscriber.on('pmessage', this.onPMessage.bind(this));
    this.subscriber.on('error', (err) => log.error({ err }, 'Redis subscriber error'));
    this.publisher.on('error', (err) => log.error({ err }, 'Redis publisher error'));

    this.subscriber.on('ready', () => {
      log.info('Redis subscriber ready');
      this.reconnectAttempts = 0;
      if (this.isSubscribed) {
        // Re-subscribe after reconnect
        void this.subscriber.psubscribe('swiip:events:*');
      }
    });

    this.publisher.on('ready', () => {
      log.info('Redis publisher ready');
    });
  }

  async connect(): Promise<void> {
    await Promise.all([this.publisher.connect(), this.subscriber.connect()]);
    await this.subscriber.psubscribe('swiip:events:*');
    this.isSubscribed = true;
    log.info('Redis PubSub connected and subscribed to swiip:events:*');
  }

  /**
   * Publishes a gateway event to the given topic.
   * Topic examples: "guild:123", "user:456", "channel:789", "broadcast"
   */
  async publish(topic: string, event: GatewayEvent): Promise<void> {
    const channel = `swiip:events:${topic}`;
    const message = JSON.stringify({ topic, event } satisfies PubSubMessage);
    try {
      await this.publisher.publish(channel, message);
    } catch (err) {
      log.error({ err, topic, op: event.op }, 'Failed to publish event');
      throw err;
    }
  }

  /**
   * Registers a handler for a specific topic.
   * Multiple handlers can be registered per topic.
   */
  subscribe(topic: string, handler: TopicHandler): void {
    let set = this.handlers.get(topic);
    if (!set) {
      set = new Set();
      this.handlers.set(topic, set);
    }
    set.add(handler);
  }

  /**
   * Removes a specific handler for a topic.
   */
  unsubscribe(topic: string, handler: TopicHandler): void {
    const set = this.handlers.get(topic);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) {
      this.handlers.delete(topic);
    }
  }

  /**
   * Removes all handlers for a topic (e.g., when a session disconnects).
   */
  unsubscribeAll(topic: string): void {
    this.handlers.delete(topic);
  }

  /**
   * Registers a handler that is invoked for EVERY incoming message,
   * regardless of topic. Used by SubscriptionManager for centralized dispatch.
   */
  subscribeGlobal(handler: TopicHandler): void {
    this.globalHandlers.add(handler);
  }

  /**
   * Removes a global handler.
   */
  unsubscribeGlobal(handler: TopicHandler): void {
    this.globalHandlers.delete(handler);
  }

  private onPMessage(_pattern: string, channel: string, rawMessage: string): void {
    // channel = "swiip:events:{topic}"
    const PREFIX = 'swiip:events:';
    const topic = channel.startsWith(PREFIX) ? channel.slice(PREFIX.length) : channel;
    let parsed: PubSubMessage;
    try {
      parsed = JSON.parse(rawMessage) as PubSubMessage;
    } catch (err) {
      log.warn({ err, channel }, 'Failed to parse pub/sub message');
      return;
    }

    // Dispatch to exact-match handlers
    const handlers = this.handlers.get(topic);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(parsed);
        } catch (err) {
          log.error({ err, topic }, 'Handler threw in onPMessage');
        }
      }
    }

    // Dispatch to global (catch-all) handlers
    for (const handler of this.globalHandlers) {
      try {
        handler(parsed);
      } catch (err) {
        log.error({ err, topic }, 'Global handler threw in onPMessage');
      }
    }
  }

  /**
   * Returns the publisher client for direct Redis commands (SET, GET, HSET, etc.)
   */
  getPublisher(): RedisClient {
    return this.publisher;
  }

  async disconnect(): Promise<void> {
    this.isSubscribed = false;
    try {
      await this.subscriber.punsubscribe('swiip:events:*');
    } catch {
      // ignore
    }
    this.publisher.disconnect();
    this.subscriber.disconnect();
    log.info('Redis PubSub disconnected');
  }
}
