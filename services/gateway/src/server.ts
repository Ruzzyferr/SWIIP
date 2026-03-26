import { App, type TemplatedApp, type HttpRequest, type HttpResponse, type WebSocket } from 'uWebSockets.js';
import { nanoid } from 'nanoid';
import type { GatewayConfig } from '@constchat/config';
import { OpCode, ServerEventType } from '@constchat/protocol';

import type { ClientSession, GatewayContext, UWSWebSocket } from './types';
import { RedisPubSub } from './redis/redis.pubsub';
import { PresenceManager } from './presence/presence.manager';
import { SubscriptionManager } from './subscriptions/subscription.manager';
import { handleMessage } from './handlers/message.handler';
import { createDefaultRateLimiter, TokenBucketRateLimiter } from './utils/rate-limiter';
import { createComponentLogger } from './utils/logger';

const log = createComponentLogger('gateway-server');

/**
 * Minimal interface for a uWS WebSocket needed by heartbeat helpers.
 * Using this avoids complicated generic gymnastics with uWS's templated types.
 */
interface WsHandle {
  getUserData(): ClientSession;
  send(data: string): number;
  end(code?: number, message?: string): void;
  getBufferedAmount(): number;
}

/**
 * GatewayServer encapsulates the entire uWebSockets.js application.
 *
 * Lifecycle:
 *   new GatewayServer(config) → .start() → [serving] → .stop()
 *
 * Connection lifecycle per client:
 *   upgrade → open → (HELLO sent) → identify → [authenticated] → message* → close
 */
export class GatewayServer {
  private readonly config: GatewayConfig;
  private readonly app: TemplatedApp;
  private readonly pubsub: RedisPubSub;
  private readonly presenceManager: PresenceManager;
  private readonly subscriptionManager: SubscriptionManager;
  private readonly rateLimiter: TokenBucketRateLimiter;
  private readonly context: GatewayContext;

  /** Active connection count for enforcement of MAX_CONNECTIONS. */
  private connectionCount = 0;
  /** uWS listen token — stored for clean shutdown. */
  private listenToken: unknown = null;

  constructor(config: GatewayConfig) {
    this.config = config;

    this.pubsub = new RedisPubSub(config.REDIS_URL);

    const redis = this.pubsub.getPublisher();
    this.presenceManager = new PresenceManager(redis, this.pubsub);
    this.subscriptionManager = new SubscriptionManager(redis, this.pubsub);
    this.rateLimiter = createDefaultRateLimiter();

    const apiBaseUrl = process.env['API_INTERNAL_URL'] ?? 'http://localhost:4000';

    this.context = {
      config,
      pubsub: this.pubsub,
      presenceManager: this.presenceManager,
      subscriptionManager: this.subscriptionManager,
      apiBaseUrl,
    };

    this.app = App();
    this.configureRoutes();
  }

  /**
   * Connects to Redis and starts listening for WebSocket connections.
   */
  async start(): Promise<void> {
    await this.pubsub.connect();
    log.info({ port: this.config.PORT }, 'Redis connected; starting WebSocket server');

    return new Promise((resolve, reject) => {
      this.app.listen(this.config.PORT, (token) => {
        if (!token) {
          reject(new Error(`Failed to bind to port ${this.config.PORT}`));
          return;
        }
        this.listenToken = token;
        log.info(
          {
            port: this.config.PORT,
            maxConnections: this.config.MAX_CONNECTIONS,
            heartbeatInterval: this.config.HEARTBEAT_INTERVAL,
          },
          'Gateway WebSocket server listening',
        );
        resolve();
      });
    });
  }

  /**
   * Gracefully shuts down the server:
   *  1. Stops accepting new connections.
   *  2. Disconnects from Redis.
   */
  async stop(): Promise<void> {
    log.info('Initiating graceful shutdown');

    if (this.listenToken) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const uws = require('uWebSockets.js') as { us_listen_socket_close: (token: unknown) => void };
      uws.us_listen_socket_close(this.listenToken);
      this.listenToken = null;
    }

    this.rateLimiter.destroy();
    await this.pubsub.disconnect();
    log.info('Gateway shutdown complete');
  }

  // ---------------------------------------------------------------------------
  // Route configuration
  // ---------------------------------------------------------------------------

  private configureRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (res: HttpResponse, _req: HttpRequest) => {
      res.writeStatus('200 OK');
      res.writeHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          status: 'ok',
          connections: this.connectionCount,
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
        }),
      );
    });

    // Metrics endpoint (Prometheus text format)
    this.app.get('/metrics', (res: HttpResponse, _req: HttpRequest) => {
      const metrics = [
        `# HELP gateway_connections_active Active WebSocket connections`,
        `# TYPE gateway_connections_active gauge`,
        `gateway_connections_active ${this.connectionCount}`,
        `# HELP gateway_subscriptions_total Total active topic subscriptions`,
        `# TYPE gateway_subscriptions_total gauge`,
        `gateway_subscriptions_total ${this.subscriptionManager.totalSubscriptions}`,
        `# HELP gateway_connected_sessions Total registered sessions`,
        `# TYPE gateway_connected_sessions gauge`,
        `gateway_connected_sessions ${this.subscriptionManager.connectedSessions}`,
      ].join('\n');

      res.writeStatus('200 OK');
      res.writeHeader('Content-Type', 'text/plain; version=0.0.4');
      res.end(metrics);
    });

    // WebSocket endpoint
    this.app.ws<ClientSession>('/gateway', {
      /* --- Connection settings --- */
      compression: 0,           // Disable per-message deflate (custom compression if needed)
      maxPayloadLength: 4_096,  // 4 KB max incoming message size
      idleTimeout: Math.ceil((this.config.HEARTBEAT_INTERVAL / 1_000) * 3), // 3× heartbeat interval
      maxBackpressure: 256 * 1_024, // 256 KB backpressure limit per connection

      /* --- Upgrade handler: enforce limits, initialize session --- */
      upgrade: (res: HttpResponse, req: HttpRequest, context) => {
        // Connection limit enforcement
        if (
          this.config.MAX_CONNECTIONS > 0 &&
          this.connectionCount >= this.config.MAX_CONNECTIONS
        ) {
          res.writeStatus('503 Service Unavailable');
          res.writeHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Server at capacity' }));
          log.warn({ max: this.config.MAX_CONNECTIONS }, 'Connection rejected: server at capacity');
          return;
        }

        // Extract IP address (respects reverse proxy headers)
        const forwarded = req.getHeader('x-forwarded-for');
        const remoteAddress = forwarded
          ? (forwarded.split(',')[0] ?? '').trim()
          : Buffer.from(res.getRemoteAddressAsText()).toString();

        // Generate stable identifiers for this connection
        const sessionId = nanoid(21);
        const socketId = nanoid(12);

        const session: ClientSession = {
          id: sessionId,
          userId: null,
          socketId,
          subscribedGuilds: new Set(),
          subscribedDMs: new Set(),
          presence: 'offline',
          heartbeatTimer: null,
          heartbeatAcked: true,
          sequence: 0,
          compress: false,
          lastMessageAt: Date.now(),
          authenticated: false,
          remoteAddress,
        };

        // Perform the WebSocket upgrade, attaching session to the user-data slot
        res.upgrade(
          session,
          req.getHeader('sec-websocket-key'),
          req.getHeader('sec-websocket-protocol'),
          req.getHeader('sec-websocket-extensions'),
          context,
        );
      },

      /* --- Open handler: register session, send HELLO, start heartbeat --- */
      open: (ws: WebSocket<ClientSession>) => {
        const session = ws.getUserData();
        this.connectionCount++;

        this.subscriptionManager.registerSession(session.id, ws as UWSWebSocket);

        log.info(
          {
            sessionId: session.id,
            socketId: session.socketId,
            remoteAddress: session.remoteAddress,
            totalConnections: this.connectionCount,
          },
          'WebSocket connection opened',
        );

        // Send HELLO — the client must respond with IDENTIFY or RESUME
        ws.send(
          JSON.stringify({
            op: OpCode.HELLO,
            t: ServerEventType.HELLO,
            d: {
              heartbeatInterval: this.config.HEARTBEAT_INTERVAL,
              sessionId: session.id,
            },
          }),
        );

        // Start the heartbeat watchdog
        this.scheduleHeartbeat(ws as unknown as WsHandle);
      },

      /* --- Message handler: rate limit → parse → dispatch --- */
      message: (ws: WebSocket<ClientSession>, message: ArrayBuffer, isBinary: boolean) => {
        handleMessage(ws as UWSWebSocket, message, isBinary, this.context, this.rateLimiter).catch(
          (err: unknown) => {
            const session = ws.getUserData();
            log.error({ err, sessionId: session?.id }, 'Unhandled error in message handler');
          },
        );
      },

      /* --- Drain handler: backpressure has cleared --- */
      drain: (ws: WebSocket<ClientSession>) => {
        const session = ws.getUserData();
        log.debug(
          { sessionId: session.id, bufferedAmount: ws.getBufferedAmount() },
          'WebSocket drain: backpressure cleared',
        );
      },

      /* --- Close handler: full teardown --- */
      close: (ws: WebSocket<ClientSession>, code: number, message: ArrayBuffer) => {
        const session = ws.getUserData();
        this.connectionCount = Math.max(0, this.connectionCount - 1);

        const closeReason = message ? Buffer.from(message).toString('utf8') : '';
        log.info(
          {
            sessionId: session.id,
            userId: session.userId,
            code,
            reason: closeReason,
            totalConnections: this.connectionCount,
          },
          'WebSocket connection closed',
        );

        // Cancel heartbeat watchdog
        if (session.heartbeatTimer) {
          clearTimeout(session.heartbeatTimer);
          session.heartbeatTimer = null;
        }

        // Free rate limiter bucket
        this.rateLimiter.remove(session.id);

        // Remove all topic subscriptions
        this.subscriptionManager.removeSession(session.id);

        // Redis cleanup + presence update (async, non-blocking)
        if (session.userId) {
          const guildIds = [...session.subscribedGuilds];
          this.cleanupSessionAsync(session.id, session.userId, guildIds, session.sequence).catch(
            (err: unknown) =>
              log.error({ err, sessionId: session.id }, 'Error during async session cleanup'),
          );
        }
      },

      /* --- Pong handler: acknowledge heartbeat --- */
      pong: (ws: WebSocket<ClientSession>, _message: ArrayBuffer) => {
        const session = ws.getUserData();
        session.heartbeatAcked = true;
        session.lastMessageAt = Date.now();
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Heartbeat management
  // ---------------------------------------------------------------------------

  /**
   * Schedules the first heartbeat watchdog for a newly opened connection.
   * After `HEARTBEAT_INTERVAL` ms, it checks whether the client responded.
   */
  private scheduleHeartbeat(ws: WsHandle): void {
    const session = ws.getUserData();

    session.heartbeatTimer = setTimeout(() => {
      this.runHeartbeatCycle(ws);
    }, this.config.HEARTBEAT_INTERVAL);
  }

  /**
   * Executes one heartbeat cycle:
   *  1. Verifies the previous cycle was acknowledged.
   *  2. Marks the session as expecting ACK.
   *  3. Refreshes presence TTL if authenticated.
   *  4. Schedules a timeout; if ACK doesn't arrive, closes the connection.
   */
  private runHeartbeatCycle(ws: WsHandle): void {
    const session = ws.getUserData();

    if (!session.heartbeatAcked) {
      log.warn(
        { sessionId: session.id, userId: session.userId },
        'Heartbeat ACK not received; closing zombie connection',
      );
      ws.end(4013, 'Heartbeat timeout');
      return;
    }

    // Mark as waiting for next acknowledgement
    session.heartbeatAcked = false;

    // Refresh presence TTL while connection is active
    if (session.userId) {
      this.presenceManager.refreshTTL(session.userId).catch((err: unknown) =>
        log.debug({ err, userId: session.userId }, 'Failed to refresh presence TTL'),
      );
    }

    // Wait for HEARTBEAT_TIMEOUT ms for an ACK before considering the connection dead
    const timeoutMs = this.config.HEARTBEAT_TIMEOUT ?? 20_000;
    session.heartbeatTimer = setTimeout(() => {
      const currentSession = ws.getUserData();
      if (!currentSession.heartbeatAcked) {
        log.warn(
          { sessionId: currentSession.id },
          'Heartbeat timeout: no ACK within window; closing',
        );
        ws.end(4013, 'Heartbeat timeout');
        return;
      }
      // ACK received — schedule the next full interval
      session.heartbeatTimer = setTimeout(() => {
        this.runHeartbeatCycle(ws);
      }, this.config.HEARTBEAT_INTERVAL - timeoutMs);
    }, timeoutMs);
  }

  // ---------------------------------------------------------------------------
  // Async session cleanup
  // ---------------------------------------------------------------------------

  /**
   * SESSION_RESUME_WINDOW_SEC — how long session state is kept in Redis after
   * a disconnect so the client can RESUME. After this window, the session
   * keys are evicted by Redis TTL and the client must re-IDENTIFY.
   *
   * 5 minutes matches the typical reconnect window in Discord-like protocols.
   */
  private static readonly SESSION_RESUME_WINDOW_SEC = 300;

  /**
   * Handles async Redis cleanup when a connection closes.
   *
   * Instead of immediately deleting the session, we:
   *  1. Record `disconnectedAt` so RESUME knows the replay window.
   *  2. Set a short TTL on session + guild-set keys (5 min resume window).
   *  3. Remove the session from the user-sessions set only after the TTL
   *     expires (or on successful RESUME, whichever comes first).
   *  4. Update presence immediately (offline if no other sessions).
   */
  private async cleanupSessionAsync(
    sessionId: string,
    userId: string,
    guildIds: string[],
    lastSequence: number,
  ): Promise<void> {
    const redis = this.pubsub.getPublisher();
    const resumeWindowSec = GatewayServer.SESSION_RESUME_WINDOW_SEC;

    try {
      const pipeline = redis.pipeline();

      // Mark the session as disconnected (but keep it alive for RESUME)
      pipeline.hset(`swiip:sessions:${sessionId}`, {
        disconnectedAt: String(Date.now()),
        sequence: String(lastSequence),
      });
      pipeline.expire(`swiip:sessions:${sessionId}`, resumeWindowSec);

      // Keep guild subscriptions alive for RESUME replay
      pipeline.expire(`swiip:session_guilds:${sessionId}`, resumeWindowSec);

      // Keep the session in the user-sessions set but let it auto-expire
      // The resume handler will clean up on successful resume
      pipeline.expire(`swiip:user_sessions:${userId}`, 86_400);

      await pipeline.exec();
    } catch (err) {
      log.warn({ err, sessionId }, 'Failed to update session state on disconnect');
    }

    try {
      await this.presenceManager.onDisconnect(userId, sessionId, guildIds);
    } catch (err) {
      log.warn({ err, sessionId, userId }, 'Failed to update presence on disconnect');
    }
  }

  // ---------------------------------------------------------------------------
  // Metrics / diagnostics
  // ---------------------------------------------------------------------------

  get activeConnections(): number {
    return this.connectionCount;
  }
}
