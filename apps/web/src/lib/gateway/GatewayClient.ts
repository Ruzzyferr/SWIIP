import { EventEmitter } from 'eventemitter3';
import {
  OpCode,
  ServerEventType,
  type ServerEvent,
  type GatewayEvent,
} from '@constchat/protocol';

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

  read_state_update: [Extract<ServerEvent, { t: ServerEventType.READ_STATE_UPDATE }>['d']];
  notification: [Extract<ServerEvent, { t: ServerEventType.NOTIFICATION }>['d']];
  error: [code: number, message: string];
};

// ---------------------------------------------------------------------------
// GatewayClient
// ---------------------------------------------------------------------------

export class GatewayClient extends EventEmitter<GatewayEventMap> {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private sequence: number = 0;
  private heartbeatInterval: number | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatAckPending: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts = 10;
  private reconnectDelay: number = 1000;
  private token: string | null = null;
  private resumeUrl: string | null = null;
  private gatewayUrl: string;
  private destroyed: boolean = false;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(gatewayUrl?: string) {
    super();
    this.gatewayUrl =
      gatewayUrl ??
      process.env.NEXT_PUBLIC_GATEWAY_URL ??
      'ws://localhost:4001';
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  connect(token: string): void {
    if (this.destroyed) return;
    this.token = token;
    this._openWebSocket(this.gatewayUrl);
  }

  disconnect(): void {
    this.destroyed = true;
    this._clearHeartbeat();
    this._clearReconnect();
    if (this.ws) {
      this.ws.onclose = null; // prevent reconnect on intentional close
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.emit('disconnected', 1000, 'Client disconnect');
  }

  send(op: OpCode, data: unknown): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn('[Gateway] Cannot send — socket not open');
      return;
    }
    const envelope: GatewayEvent = { op, d: data };
    this.ws.send(JSON.stringify(envelope));
  }

  updatePresence(status: string, activities: unknown[] = []): void {
    this.send(OpCode.PRESENCE_UPDATE, { status, activities });
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
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
    };

    this.ws.onmessage = (event: MessageEvent<string>) => {
      this._handleMessage(event.data);
    };

    this.ws.onclose = (event) => {
      this._clearHeartbeat();
      this.emit('disconnected', event.code, event.reason);
      if (!this.destroyed) {
        this._scheduleReconnect();
      }
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
        browser: 'ConstChat Web',
        device: 'ConstChat Web',
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
    // Jitter: start first beat at a random offset ≤ interval
    const jitter = Math.random() * interval;
    setTimeout(() => {
      this._sendHeartbeat();
      this.heartbeatTimer = setInterval(() => this._sendHeartbeat(), interval);
    }, jitter);
  }

  private _sendHeartbeat(): void {
    if (this.heartbeatAckPending) {
      // Server didn't ack last heartbeat — zombie connection
      console.warn('[Gateway] Heartbeat ACK not received — reconnecting');
      this._openWebSocket(this.resumeUrl ?? this.gatewayUrl);
      return;
    }
    this.heartbeatAckPending = true;
    this.send(OpCode.HEARTBEAT, this.sequence);
  }

  private _clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
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
        this._startHeartbeat(heartbeatInterval);
        if (this.sessionId) {
          this._resume();
        } else {
          this._identify();
        }
        break;
      }

      case OpCode.HEARTBEAT_ACK: {
        this.heartbeatAckPending = false;
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
        this._openWebSocket(this.resumeUrl ?? this.gatewayUrl);
        break;
      }

      case OpCode.INVALID_SESSION: {
        const resumable = Boolean(event.d);
        this.emit('invalid_session', resumable);
        if (!resumable) {
          this.sessionId = null;
          this.sequence = 0;
        }
        // Wait a moment then re-identify
        setTimeout(() => {
          if (resumable) this._resume();
          else this._identify();
        }, 2000 + Math.random() * 3000);
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
        this.emit('ready', data);
        break;
      }

      case ServerEventType.RESUMED:
        this.emit('resumed');
        break;

      case ServerEventType.HEARTBEAT_ACK:
        this.heartbeatAckPending = false;
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
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[Gateway] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    // Exponential backoff: 1s → 2s → 4s → … → 30s cap, +random jitter
    const delay = Math.min(
      this.reconnectDelay * 2 ** (this.reconnectAttempts - 1),
      30_000
    );
    const jitter = Math.random() * 1000;

    console.info(
      `[Gateway] Reconnecting in ${Math.round(delay + jitter)}ms (attempt ${this.reconnectAttempts})`
    );

    this.emit('reconnecting', this.reconnectAttempts);

    this.reconnectTimeout = setTimeout(() => {
      const url = this.resumeUrl ?? this.gatewayUrl;
      this._openWebSocket(url);
    }, delay + jitter);
  }

  private _clearReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
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
