import { EventEmitter } from 'eventemitter3';
import {
  OpCode,
  ServerEventType,
  type ServerEvent,
  type GatewayEvent,
} from '@constchat/protocol';
import { getPlatformProvider } from '@/lib/platform';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GatewayEventMap = {
  connected: [];
  disconnected: [code: number, reason: string];
  reconnecting: [attempt: number];

  // Server dispatch events
  ready: [Extract<ServerEvent, { t: ServerEventType.READY }>['d']];
  resumed: [];
  invalid_session: [resumable: boolean];

  message_create: [Extract<ServerEvent, { t: ServerEventType.MESSAGE_CREATE }>['d']];
  message_update: [Extract<ServerEvent, { t: ServerEventType.MESSAGE_UPDATE }>['d']];
  message_delete: [Extract<ServerEvent, { t: ServerEventType.MESSAGE_DELETE }>['d']];

  typing_start: [Extract<ServerEvent, { t: ServerEventType.TYPING_START }>['d']];
  presence_update: [Extract<ServerEvent, { t: ServerEventType.PRESENCE_UPDATE }>['d']];

  guild_create: [Extract<ServerEvent, { t: ServerEventType.GUILD_CREATE }>['d']];
  guild_update: [Extract<ServerEvent, { t: ServerEventType.GUILD_UPDATE }>['d']];
  guild_delete: [Extract<ServerEvent, { t: ServerEventType.GUILD_DELETE }>['d']];

  member_add: [Extract<ServerEvent, { t: ServerEventType.GUILD_MEMBER_ADD }>['d']];
  member_remove: [Extract<ServerEvent, { t: ServerEventType.GUILD_MEMBER_REMOVE }>['d']];
  member_update: [Extract<ServerEvent, { t: ServerEventType.GUILD_MEMBER_UPDATE }>['d']];

  channel_create: [Extract<ServerEvent, { t: ServerEventType.CHANNEL_CREATE }>['d']];
  channel_update: [Extract<ServerEvent, { t: ServerEventType.CHANNEL_UPDATE }>['d']];
  channel_delete: [Extract<ServerEvent, { t: ServerEventType.CHANNEL_DELETE }>['d']];

  reaction_add: [Extract<ServerEvent, { t: ServerEventType.REACTION_ADD }>['d']];
  reaction_remove: [Extract<ServerEvent, { t: ServerEventType.REACTION_REMOVE }>['d']];

  voice_state_update: [Extract<ServerEvent, { t: ServerEventType.VOICE_STATE_UPDATE }>['d']];
  voice_server_update: [Extract<ServerEvent, { t: ServerEventType.VOICE_SERVER_UPDATE }>['d']];
  screen_share_started: [Extract<ServerEvent, { t: ServerEventType.SCREEN_SHARE_STARTED }>['d']];
  screen_share_stopped: [Extract<ServerEvent, { t: ServerEventType.SCREEN_SHARE_STOPPED }>['d']];

  read_state_update: [Extract<ServerEvent, { t: ServerEventType.READ_STATE_UPDATE }>['d']];
  notification: [Extract<ServerEvent, { t: ServerEventType.NOTIFICATION }>['d']];
  error: [code: number, message: string];
};

// ---------------------------------------------------------------------------
// GatewayClient
// ---------------------------------------------------------------------------

export class GatewayClient extends EventEmitter<GatewayEventMap> {
  // Close codes that are non-recoverable — do not reconnect
  private static readonly FATAL_CLOSE_CODES = new Set([
    4004, // Authentication failed
  ]);

  // Close codes that invalidate the current session — clear state, then reconnect fresh
  private static readonly SESSION_RESET_CODES = new Set([
    4007, // Invalid sequence
    4009, // Session timed out / invalid
  ]);

  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private sequence: number = 0;
  private heartbeatInterval: number | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private jitterTimeout: ReturnType<typeof setTimeout> | null = null;
  private heartbeatAckPending: boolean = false;
  /** Number of consecutive missed heartbeat ACKs. Allows up to 2 before declaring zombie. */
  private missedHeartbeats: number = 0;
  private reconnectAttempts: number = 0;
  private reconnectDelay: number = 1000;
  private token: string | null = null;
  private resumeUrl: string | null = null;
  private gatewayUrl: string;
  private destroyed: boolean = false;
  private resumeRetryCount: number = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private invalidSessionTimeout: ReturnType<typeof setTimeout> | null = null;
  private helloTimeout: ReturnType<typeof setTimeout> | null = null;
  /** Timestamp of the last successful READY/RESUMED — used for time-based backoff reset (discord.py pattern). */
  private lastStableAt: number = 0;
  /** Timestamp of last heartbeat ACK — used to detect zombie with tolerance. */
  private lastAckAt: number = 0;
  /** Outbound message queue — buffers sends during reconnect, replayed on RESUMED. */
  private sendQueue: Array<{ op: OpCode; data: unknown }> = [];
  /** Bound visibility change handler for cleanup. */
  private _onVisibilityChange: (() => void) | null = null;

  constructor(gatewayUrl?: string) {
    super();
    const base =
      gatewayUrl ??
      process.env.NEXT_PUBLIC_GATEWAY_URL ??
      'ws://localhost:4001';
    // Ensure the URL ends with /gateway (the uWS route)
    this.gatewayUrl = base.endsWith('/gateway') ? base : `${base}/gateway`;

    // Desktop: on system resume (wake from sleep), trigger immediate reconnect
    const platform = getPlatformProvider();
    if (platform.isDesktop) {
      platform.onSystemResume(() => {
        if (this.ws?.readyState !== WebSocket.OPEN && this.token) {
          console.info('[Gateway] System resumed — triggering immediate reconnect');
          this._clearReconnect();
          this.reconnectAttempts = 0;
          this._openWebSocket(this.gatewayUrl);
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  connect(token: string): void {
    // Re-enable the client after a normal disconnect cleanup.
    this.destroyed = false;
    const ws = this.ws;
    if (
      this.token === token &&
      ws &&
      (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    this.token = token;
    this._openWebSocket(this.gatewayUrl);
  }

  disconnect(): void {
    // Normal app-level disconnect should be reversible (logout/login, route remounts).
    // Keep destroyed=false so connect() can be called again.
    this.destroyed = false;
    this._clearHeartbeat();
    this._clearReconnect();
    this.sendQueue.length = 0; // Clear buffered messages on intentional disconnect
    if (this.ws) {
      this.ws.onclose = null; // prevent reconnect on intentional close
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.emit('disconnected', 1000, 'Client disconnect');
  }

  send(op: OpCode, data: unknown): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      // Buffer dispatch events during reconnect — replay on RESUMED (Discord pattern)
      if (op === OpCode.DISPATCH && !this.destroyed) {
        this.sendQueue.push({ op, data });
        console.debug('[Gateway] Buffered outgoing dispatch during reconnect');
        return true; // Indicate message was accepted (queued)
      }
      console.warn('[Gateway] Cannot send — socket not open, readyState:', this.ws?.readyState);
      return false;
    }
    // For DISPATCH events, the gateway expects { op, t, d } at the envelope level
    // Callers pass { t: 'EVENT_TYPE', d: { ... } } as data — hoist t to the envelope
    if (op === OpCode.DISPATCH && data && typeof data === 'object' && 't' in data) {
      const { t, d } = data as { t: string; d: unknown };
      const msg = JSON.stringify({ op, t, d });
      console.debug('[Gateway] Sending dispatch:', t, d);
      this.ws.send(msg);
      return true;
    }
    const envelope: GatewayEvent = { op, d: data };
    this.ws.send(JSON.stringify(envelope));
    return true;
  }

  updatePresence(status: string, activities: unknown[] = [], customStatus?: string): void {
    this.send(OpCode.PRESENCE_UPDATE, { status, activities, customStatus });
  }

  // ---------------------------------------------------------------------------
  // Private — connection lifecycle
  // ---------------------------------------------------------------------------

  private _openWebSocket(url: string): void {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.emit('connected');
      // NOTE: reconnectAttempts is NOT reset here — it is reset only when the
      // session is fully established (READY/RESUMED).  Resetting on open caused
      // an infinite reconnect loop when the socket opened but closed immediately
      // before completing the handshake (buape/carbon#344).
    };

    this.ws.onmessage = (event: MessageEvent<string>) => {
      this._handleMessage(event.data);
    };

    this.ws.onclose = (event) => {
      this._clearHeartbeat();
      this.emit('disconnected', event.code, event.reason);

      if (this.destroyed) return;

      // Fatal codes — stop reconnecting entirely
      if (GatewayClient.FATAL_CLOSE_CODES.has(event.code)) {
        this.emit('error', event.code, event.reason || 'Connection terminated');
        return;
      }

      // Session-invalidating codes — clear stale state, reconnect fresh
      if (GatewayClient.SESSION_RESET_CODES.has(event.code)) {
        this.sessionId = null;
        this.sequence = 0;
        this.resumeUrl = null;
      }

      this._scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onclose will fire after onerror; no need to duplicate logic
      console.error('[Gateway] WebSocket error');
    };
  }

  // ---------------------------------------------------------------------------
  // Private — identify / resume
  // ---------------------------------------------------------------------------

  private _identify(): void {
    if (!this.token) return;
    this.send(OpCode.IDENTIFY, {
      token: this.token,
      properties: {
        os: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
        browser: 'Swiip Web',
        device: 'Swiip Web',
      },
      compress: false,
    });
  }

  private _resume(): void {
    if (!this.token || !this.sessionId) {
      this._identify();
      return;
    }
    this.send(OpCode.RESUME, {
      token: this.token,
      sessionId: this.sessionId,
      seq: this.sequence,
    });
  }

  // ---------------------------------------------------------------------------
  // Private — heartbeat
  // ---------------------------------------------------------------------------

  private _startHeartbeat(interval: number): void {
    this._clearHeartbeat();
    this.heartbeatInterval = interval;
    this.missedHeartbeats = 0;
    this.lastAckAt = Date.now();

    // Jitter: start first beat at a random offset ≤ interval
    const jitter = Math.random() * interval;
    this.jitterTimeout = setTimeout(() => {
      this.jitterTimeout = null;
      this._sendHeartbeat();
      this.heartbeatTimer = setInterval(() => this._sendHeartbeat(), interval);
    }, jitter);

    // Handle Page Visibility API — browsers throttle timers in background tabs.
    // When user returns, send an immediate heartbeat to keep the connection alive
    // instead of letting the zombie detector kill it.
    // On desktop (Electron), this is disabled — timers run at full speed.
    this._removeVisibilityListener();
    const platform = getPlatformProvider();
    if (platform.heartbeatConfig.useVisibilityAPI && typeof document !== 'undefined') {
      this._onVisibilityChange = () => {
        if (!document.hidden && this.ws?.readyState === WebSocket.OPEN) {
          // Tab is visible again — check how long we were away
          const elapsed = Date.now() - this.lastAckAt;
          if (elapsed > interval * 1.5) {
            // We likely missed beats while backgrounded — send immediate heartbeat
            // Reset missed counter since the missed beats were due to throttling, not a dead server
            this.missedHeartbeats = 0;
            this.heartbeatAckPending = false;
            this._sendHeartbeat();
            console.debug('[Gateway] Tab restored — sent immediate heartbeat after', Math.round(elapsed / 1000), 's');
          }
        }
      };
      document.addEventListener('visibilitychange', this._onVisibilityChange);
    }
  }

  private _sendHeartbeat(): void {
    const platform = getPlatformProvider();
    const tolerance = platform.heartbeatConfig.missedAckTolerance;

    // If tab is hidden and visibility API is active, skip zombie detection — browsers throttle timers
    const isHidden = platform.heartbeatConfig.useVisibilityAPI &&
      typeof document !== 'undefined' && document.hidden;

    if (this.heartbeatAckPending && !isHidden) {
      this.missedHeartbeats++;
      if (this.missedHeartbeats >= tolerance) {
        console.warn(`[Gateway] ${this.missedHeartbeats} heartbeat ACKs missed — zombie connection`);
        this._clearHeartbeat();
        this.ws?.close(4000, 'Zombie connection');
        return;
      }
      console.debug(`[Gateway] Heartbeat ACK pending (miss ${this.missedHeartbeats}/${tolerance}) — sending another`);
    }
    this.heartbeatAckPending = true;
    this.send(OpCode.HEARTBEAT, this.sequence);
  }

  private _removeVisibilityListener(): void {
    if (this._onVisibilityChange && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._onVisibilityChange);
      this._onVisibilityChange = null;
    }
  }

  private _clearHeartbeat(): void {
    if (this.jitterTimeout) {
      clearTimeout(this.jitterTimeout);
      this.jitterTimeout = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this._removeVisibilityListener();
  }

  // ---------------------------------------------------------------------------
  // Private — message routing
  // ---------------------------------------------------------------------------

  private _handleMessage(raw: string): void {
    let event: GatewayEvent;
    try {
      event = JSON.parse(raw) as GatewayEvent;
    } catch {
      console.error('[Gateway] Failed to parse message', raw);
      return;
    }

    if (event.s != null) {
      this.sequence = event.s;
    }

    switch (event.op) {
      case OpCode.HELLO: {
        const { heartbeatInterval, sessionId } = event.d as {
          heartbeatInterval: number;
          sessionId: string;
        };
        this.resumeRetryCount = 0;
        this._startHeartbeat(heartbeatInterval);

        const isResume = !!this.sessionId;
        if (isResume) {
          this._resume();
        } else {
          this._identify();
        }

        // Start a 30s timeout for READY/RESUMED.
        // If the server doesn't respond after IDENTIFY/RESUME, close and retry.
        this._clearHelloTimeout();
        this.helloTimeout = setTimeout(() => {
          this.helloTimeout = null;
          console.warn('[Gateway] READY/RESUMED timeout — closing connection');
          // If it was a RESUME that timed out, clear session so next attempt
          // does a fresh IDENTIFY
          if (isResume) {
            this.sessionId = null;
            this.sequence = 0;
            this.resumeUrl = null;
          }
          this.ws?.close(4000, 'READY timeout');
        }, 30_000);
        break;
      }

      case OpCode.HEARTBEAT_ACK: {
        this.heartbeatAckPending = false;
        this.missedHeartbeats = 0;
        this.lastAckAt = Date.now();
        break;
      }

      case OpCode.HEARTBEAT: {
        // Server requesting immediate heartbeat
        this.heartbeatAckPending = false;
        this._sendHeartbeat();
        break;
      }

      case OpCode.RECONNECT: {
        console.info('[Gateway] Server requested reconnect');
        this._clearHeartbeat();
        this.ws?.close(4000, 'Server requested reconnect');
        break;
      }

      case OpCode.INVALID_SESSION: {
        const resumable = event.d && typeof event.d === 'object'
          ? Boolean((event.d as { resumable?: boolean }).resumable)
          : Boolean(event.d);
        this.emit('invalid_session', resumable);
        // Avoid infinite RESUME loops against active/stale sessions.
        // Allow up to 2 resume retries with exponential delay (gives server
        // time to complete cleanupSessionAsync before we retry).
        this.resumeRetryCount += 1;
        const shouldRetryResume = resumable && this.resumeRetryCount <= 2;
        if (!shouldRetryResume) {
          this.sessionId = null;
          this.sequence = 0;
          this.resumeUrl = null;
        }
        if (this.invalidSessionTimeout) {
          clearTimeout(this.invalidSessionTimeout);
          this.invalidSessionTimeout = null;
        }
        // Exponential backoff for resume retries: 2s, 4s — gives the server
        // time to set disconnectedAt in Redis before we retry RESUME.
        const baseDelay = shouldRetryResume
          ? 2000 * this.resumeRetryCount
          : 1000;
        this.invalidSessionTimeout = setTimeout(() => {
          this.invalidSessionTimeout = null;
          if (this.destroyed) return;
          if (shouldRetryResume) this._resume();
          else this._identify();
        }, baseDelay + Math.random() * 1000);
        break;
      }

      case OpCode.DISPATCH: {
        this._handleDispatch(event as ServerEvent & { s: number });
        break;
      }

      default:
        break;
    }
  }

  private _handleDispatch(event: ServerEvent): void {
    switch (event.t) {
      case ServerEventType.HELLO:
        break;

      case ServerEventType.READY: {
        const data = event.d;
        this.sessionId = data.sessionId;
        this.resumeUrl = data.resumeUrl ?? null;
        this.resumeRetryCount = 0;
        this._onSessionEstablished();
        this.emit('ready', data);
        break;
      }

      case ServerEventType.RESUMED:
        this._onSessionEstablished();
        this.emit('resumed');
        break;

      case ServerEventType.HEARTBEAT_ACK:
        this.heartbeatAckPending = false;
        this.missedHeartbeats = 0;
        this.lastAckAt = Date.now();
        break;

      case ServerEventType.INVALID_SESSION:
        this.emit('invalid_session', event.d.resumable);
        break;

      case ServerEventType.MESSAGE_CREATE:
        this.emit('message_create', event.d);
        break;

      case ServerEventType.MESSAGE_UPDATE:
        this.emit('message_update', event.d);
        break;

      case ServerEventType.MESSAGE_DELETE:
        this.emit('message_delete', event.d);
        break;

      case ServerEventType.TYPING_START:
        this.emit('typing_start', event.d);
        break;

      case ServerEventType.PRESENCE_UPDATE:
        this.emit('presence_update', event.d);
        break;

      case ServerEventType.GUILD_CREATE:
        this.emit('guild_create', event.d);
        break;

      case ServerEventType.GUILD_UPDATE:
        this.emit('guild_update', event.d);
        break;

      case ServerEventType.GUILD_DELETE:
        this.emit('guild_delete', event.d);
        break;

      case ServerEventType.GUILD_MEMBER_ADD:
        this.emit('member_add', event.d);
        break;

      case ServerEventType.GUILD_MEMBER_REMOVE:
        this.emit('member_remove', event.d);
        break;

      case ServerEventType.GUILD_MEMBER_UPDATE:
        this.emit('member_update', event.d);
        break;

      case ServerEventType.CHANNEL_CREATE:
        this.emit('channel_create', event.d);
        break;

      case ServerEventType.CHANNEL_UPDATE:
        this.emit('channel_update', event.d);
        break;

      case ServerEventType.CHANNEL_DELETE:
        this.emit('channel_delete', event.d);
        break;

      case ServerEventType.REACTION_ADD:
        this.emit('reaction_add', event.d);
        break;

      case ServerEventType.REACTION_REMOVE:
        this.emit('reaction_remove', event.d);
        break;

      case ServerEventType.VOICE_STATE_UPDATE:
        this.emit('voice_state_update', event.d);
        break;

      case ServerEventType.VOICE_SERVER_UPDATE:
        this.emit('voice_server_update', event.d);
        break;

      case ServerEventType.SCREEN_SHARE_STARTED:
        this.emit('screen_share_started', event.d);
        break;

      case ServerEventType.SCREEN_SHARE_STOPPED:
        this.emit('screen_share_stopped', event.d);
        break;

      case ServerEventType.READ_STATE_UPDATE:
        this.emit('read_state_update', event.d);
        break;

      case ServerEventType.NOTIFICATION:
        this.emit('notification', event.d);
        break;

      case ServerEventType.ERROR:
        this.emit('error', event.d.code, event.d.message);
        break;

      default:
        console.debug('[Gateway] Unknown event type', (event as { t?: string }).t);
    }
  }

  // ---------------------------------------------------------------------------
  // Private — reconnect
  // ---------------------------------------------------------------------------

  private _scheduleReconnect(): void {
    if (this.destroyed) return;

    const platform = getPlatformProvider();
    const { maxAttempts, cap } = platform.reconnectConfig;

    // Time-based auto-reset (discord.py pattern): if the connection was stable
    // long enough, reset the backoff so a fresh disconnect reconnects quickly.
    const stableThreshold = this.reconnectDelay * 2 ** 11; // ~34 min at 1s base
    if (this.lastStableAt > 0 && Date.now() - this.lastStableAt > stableThreshold) {
      this.reconnectAttempts = 0;
    }

    if (this.reconnectAttempts >= maxAttempts) {
      console.error(`[Gateway] Max reconnect attempts (${maxAttempts}) reached`);
      this.emit('error', 4999, 'Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;

    // After 3 failed attempts with resumeUrl, fall back to gatewayUrl
    // and clear session state to force a fresh IDENTIFY.
    if (this.reconnectAttempts > 3 && this.resumeUrl) {
      console.warn('[Gateway] Resume URL failed repeatedly; falling back to gateway URL');
      this.resumeUrl = null;
      this.sessionId = null;
      this.sequence = 0;
    }

    // Full Jitter (AWS best practice): sleep = random(0, min(cap, base * 2^attempt))
    const expDelay = Math.min(this.reconnectDelay * 2 ** (this.reconnectAttempts - 1), cap);
    const delay = Math.random() * expDelay;

    console.info(
      `[Gateway] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})`
    );

    this.emit('reconnecting', this.reconnectAttempts);

    this._clearReconnect();
    this.reconnectTimeout = setTimeout(() => {
      const url = this.resumeUrl ?? this.gatewayUrl;
      this._openWebSocket(url);
    }, delay);
  }

  /**
   * Called when the gateway session is fully established (READY or RESUMED).
   * This is the ONLY place where reconnect counters are reset — never on raw
   * socket open.  Matches the pattern used by discord.js, discord.py, JDA, and
   * Carbon (after the fix for buape/carbon#344).
   */
  private _onSessionEstablished(): void {
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    this.missedHeartbeats = 0;
    this.lastStableAt = Date.now();
    this.lastAckAt = Date.now();
    this._clearHelloTimeout();
    // Replay buffered outgoing messages (Discord pattern: events sent during
    // reconnect are replayed once session is re-established)
    this._flushSendQueue();
  }

  private _flushSendQueue(): void {
    if (this.sendQueue.length === 0) return;
    console.debug(`[Gateway] Replaying ${this.sendQueue.length} buffered message(s)`);
    const queue = this.sendQueue.splice(0);
    for (const { op, data } of queue) {
      this.send(op, data);
    }
  }

  private _clearHelloTimeout(): void {
    if (this.helloTimeout) {
      clearTimeout(this.helloTimeout);
      this.helloTimeout = null;
    }
  }

  private _clearReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.invalidSessionTimeout) {
      clearTimeout(this.invalidSessionTimeout);
      this.invalidSessionTimeout = null;
    }
    this._clearHelloTimeout();
  }
}

// Singleton for the app to use
let _gatewayClient: GatewayClient | null = null;

export function getGatewayClient(): GatewayClient {
  if (!_gatewayClient) {
    _gatewayClient = new GatewayClient();
  }
  return _gatewayClient;
}
