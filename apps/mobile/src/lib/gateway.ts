import { EventEmitter } from 'eventemitter3';
import {
  OpCode,
  ServerEventType,
  type ServerEvent,
  type GatewayEvent,
} from '@constchat/protocol';
import { AppState, type AppStateStatus } from 'react-native';
import Constants from 'expo-constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GatewayEventMap = {
  connected: [];
  disconnected: [code: number, reason: string];
  reconnecting: [attempt: number];

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
// Mobile Platform Config
// ---------------------------------------------------------------------------

const MOBILE_CONFIG = {
  heartbeat: {
    missedAckTolerance: 2,
  },
  reconnect: {
    maxAttempts: 20, // Mobile: try harder than web
    cap: 30000,
  },
};

// ---------------------------------------------------------------------------
// GatewayClient (Mobile)
// ---------------------------------------------------------------------------

export class GatewayClient extends EventEmitter<GatewayEventMap> {
  private static readonly FATAL_CLOSE_CODES = new Set([4004]);
  private static readonly SESSION_RESET_CODES = new Set([4007, 4009]);

  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private sequence: number = 0;
  private heartbeatInterval: number | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private jitterTimeout: ReturnType<typeof setTimeout> | null = null;
  private heartbeatAckPending: boolean = false;
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
  private lastStableAt: number = 0;
  private lastAckAt: number = 0;
  private sendQueue: Array<{ op: OpCode; data: unknown }> = [];
  private appStateSubscription: { remove: () => void } | null = null;

  constructor(gatewayUrl?: string) {
    super();
    const base =
      gatewayUrl ??
      Constants.expoConfig?.extra?.gatewayUrl ??
      'wss://swiip.app';
    this.gatewayUrl = base.endsWith('/gateway') ? base : `${base}/gateway`;

    // Mobile: reconnect when app returns from background
    this.appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && this.token) {
        if (this.ws?.readyState !== WebSocket.OPEN) {
          console.info('[Gateway] App became active — triggering reconnect');
          this._clearReconnect();
          this.reconnectAttempts = 0;
          this._openWebSocket(this.gatewayUrl);
        } else if (this.heartbeatInterval) {
          // Send immediate heartbeat after returning from background
          const elapsed = Date.now() - this.lastAckAt;
          if (elapsed > this.heartbeatInterval * 1.5) {
            this.missedHeartbeats = 0;
            this.heartbeatAckPending = false;
            this._sendHeartbeat();
            console.debug('[Gateway] App resumed — sent immediate heartbeat');
          }
        }
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  connect(token: string): void {
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
    this.destroyed = false;
    this._clearHeartbeat();
    this._clearReconnect();
    this.sendQueue.length = 0;
    this.sessionId = null;
    this.sequence = 0;
    this.resumeUrl = null;
    this.resumeRetryCount = 0;
    this.heartbeatAckPending = false;
    this.missedHeartbeats = 0;
    this.lastStableAt = 0;
    this.lastAckAt = 0;
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.emit('disconnected', 1000, 'Client disconnect');
  }

  destroy(): void {
    this.disconnect();
    this.destroyed = true;
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
    this.removeAllListeners();
  }

  send(op: OpCode, data: unknown): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      if (op === OpCode.DISPATCH && !this.destroyed) {
        this.sendQueue.push({ op, data });
        return true;
      }
      return false;
    }
    if (op === OpCode.DISPATCH && data && typeof data === 'object' && 't' in data) {
      const { t, d } = data as { t: string; d: unknown };
      this.ws.send(JSON.stringify({ op, t, d }));
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
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.close();
    }

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.emit('connected');
    };

    this.ws.onmessage = (event: WebSocketMessageEvent) => {
      const data = typeof event.data === 'string' ? event.data : '';
      this._handleMessage(data);
    };

    this.ws.onclose = (event: WebSocketCloseEvent) => {
      this._clearHeartbeat();
      const code = event.code ?? 1006;
      const reason = event.reason ?? '';
      this.emit('disconnected', code, reason);

      if (this.destroyed) return;

      if (GatewayClient.FATAL_CLOSE_CODES.has(code)) {
        this.emit('error', code, reason || 'Connection terminated');
        return;
      }

      if (GatewayClient.SESSION_RESET_CODES.has(code)) {
        this.sessionId = null;
        this.sequence = 0;
        this.resumeUrl = null;
      }

      this._scheduleReconnect();
    };

    this.ws.onerror = () => {
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
        os: 'mobile',
        browser: 'Swiip Mobile',
        device: 'Swiip Mobile',
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

    const jitter = Math.random() * interval;
    this.jitterTimeout = setTimeout(() => {
      this.jitterTimeout = null;
      this._sendHeartbeat();
      this.heartbeatTimer = setInterval(() => this._sendHeartbeat(), interval);
    }, jitter);
  }

  private _sendHeartbeat(): void {
    const tolerance = MOBILE_CONFIG.heartbeat.missedAckTolerance;

    // On mobile, skip zombie detection if app is in background
    const isBackground = AppState.currentState !== 'active';

    if (this.heartbeatAckPending && !isBackground) {
      this.missedHeartbeats++;
      if (this.missedHeartbeats >= tolerance) {
        console.warn(`[Gateway] ${this.missedHeartbeats} heartbeat ACKs missed — zombie connection`);
        this._clearHeartbeat();
        this.ws?.close(4000, 'Zombie connection');
        return;
      }
    }
    this.heartbeatAckPending = true;
    this.send(OpCode.HEARTBEAT, this.sequence);
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
  }

  // ---------------------------------------------------------------------------
  // Private — message routing
  // ---------------------------------------------------------------------------

  private _handleMessage(raw: string): void {
    let event: GatewayEvent;
    try {
      event = JSON.parse(raw) as GatewayEvent;
    } catch {
      console.error('[Gateway] Failed to parse message');
      return;
    }

    if (event.s != null) {
      this.sequence = event.s;
    }

    switch (event.op) {
      case OpCode.HELLO: {
        const { heartbeatInterval } = event.d as { heartbeatInterval: number };
        this.resumeRetryCount = 0;
        this._startHeartbeat(heartbeatInterval);

        const isResume = !!this.sessionId;
        if (isResume) {
          this._resume();
        } else {
          this._identify();
        }

        this._clearHelloTimeout();
        this.helloTimeout = setTimeout(() => {
          this.helloTimeout = null;
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
        this.heartbeatAckPending = false;
        this._sendHeartbeat();
        break;
      }

      case OpCode.RECONNECT: {
        this._clearHeartbeat();
        this.ws?.close(4000, 'Server requested reconnect');
        break;
      }

      case OpCode.INVALID_SESSION: {
        const resumable = event.d && typeof event.d === 'object'
          ? Boolean((event.d as { resumable?: boolean }).resumable)
          : Boolean(event.d);
        this.emit('invalid_session', resumable);
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
        const baseDelay = shouldRetryResume ? 2000 * this.resumeRetryCount : 1000;
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
    }
  }

  // ---------------------------------------------------------------------------
  // Private — reconnect
  // ---------------------------------------------------------------------------

  private _scheduleReconnect(): void {
    if (this.destroyed) return;

    const { maxAttempts, cap } = MOBILE_CONFIG.reconnect;

    const stableThreshold = this.reconnectDelay * 2 ** 11;
    if (this.lastStableAt > 0 && Date.now() - this.lastStableAt > stableThreshold) {
      this.reconnectAttempts = 0;
    }

    if (this.reconnectAttempts >= maxAttempts) {
      console.error(`[Gateway] Max reconnect attempts (${maxAttempts}) reached`);
      this.emit('error', 4999, 'Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;

    if (this.reconnectAttempts > 3 && this.resumeUrl) {
      this.resumeUrl = null;
      this.sessionId = null;
      this.sequence = 0;
    }

    const expDelay = Math.min(this.reconnectDelay * 2 ** (this.reconnectAttempts - 1), cap);
    const delay = Math.random() * expDelay;

    this.emit('reconnecting', this.reconnectAttempts);

    this._clearReconnect();
    this.reconnectTimeout = setTimeout(() => {
      const url = this.resumeUrl ?? this.gatewayUrl;
      this._openWebSocket(url);
    }, delay);
  }

  private _onSessionEstablished(): void {
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    this.missedHeartbeats = 0;
    this.lastStableAt = Date.now();
    this.lastAckAt = Date.now();
    this._clearHelloTimeout();
    this._flushSendQueue();
  }

  private _flushSendQueue(): void {
    if (this.sendQueue.length === 0) return;
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

// Singleton
let _gatewayClient: GatewayClient | null = null;

export function getGatewayClient(): GatewayClient {
  if (!_gatewayClient) {
    _gatewayClient = new GatewayClient();
  }
  return _gatewayClient;
}
