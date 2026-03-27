import type { WebSocket } from 'uWebSockets.js';
import type { PresenceStatus } from '@constchat/protocol';
import type { RedisPubSub } from './redis/redis.pubsub';
import type { PresenceManager } from './presence/presence.manager';
import type { SubscriptionManager } from './subscriptions/subscription.manager';
import type { GatewayConfig } from '@constchat/config';

/**
 * Per-connection session state stored in the uWS WebSocket user data slot.
 */
export interface ClientSession {
  /** Unique session UUID (nanoid). */
  id: string;
  /** Authenticated user ID. null before IDENTIFY completes. */
  userId: string | null;
  /** Stable socket identifier for logging / indexing. */
  socketId: string;
  /** Guild IDs this session is subscribed to. */
  subscribedGuilds: Set<string>;
  /** DM channel IDs this session is subscribed to. */
  subscribedDMs: Set<string>;
  /** Current presence status. */
  presence: PresenceStatus;
  /** Reference to the active heartbeat timeout; null when not waiting. */
  heartbeatTimer: NodeJS.Timeout | null;
  /** True when the client has sent a HEARTBEAT ACK for the last ping. */
  heartbeatAcked: boolean;
  /** Incrementing sequence number for DISPATCH events sent on this session. */
  sequence: number;
  /** Whether this client requested zlib compression (not currently active). */
  compress: boolean;
  /** Unix ms timestamp of the last message received from this client. */
  lastMessageAt: number;
  /** Whether IDENTIFY has been completed on this connection. */
  authenticated: boolean;
  /** IP address extracted at upgrade time. */
  remoteAddress: string;
}

/**
 * Shared context object threaded through all gateway handlers.
 */
export interface GatewayContext {
  config: GatewayConfig;
  pubsub: RedisPubSub;
  presenceManager: PresenceManager;
  subscriptionManager: SubscriptionManager;
  /** Base URL of the internal API service (for fetching user/guild data). */
  apiBaseUrl: string;
  /** Base URL of media-signalling service used for voice join. */
  mediaBaseUrl: string;
}

/**
 * Shape of the internal gateway event envelope published to Redis.
 */
export interface InternalGatewayEvent {
  op: number;
  t?: string;
  d: unknown;
  s?: number;
}

export type UWSWebSocket = WebSocket<ClientSession>;
