import type { UWSWebSocket, GatewayContext } from '../types';
import {
  OpCode,
  ClientEventType,
  ServerEventType,
  type PresenceStatus,
} from '@constchat/protocol';
import { handleIdentify } from './identify.handler';
import { handleResume } from './resume.handler';
import type { TokenBucketRateLimiter } from '../utils/rate-limiter';
import { createComponentLogger } from '../utils/logger';

const log = createComponentLogger('message-handler');

/** Maximum raw message size in bytes (4 KB). */
const MAX_MESSAGE_SIZE = 4_096;

/** Close code used when a client exceeds the rate limit. */
const RATE_LIMIT_CLOSE_CODE = 4008;

/**
 * Routes an incoming WebSocket message to the correct handler.
 *
 * Responsibilities:
 *  - Enforce per-connection rate limits (120 messages / 60s).
 *  - Parse and validate JSON structure.
 *  - Dispatch to the appropriate opcode handler.
 *  - Log malformed / unexpected messages.
 */
export async function handleMessage(
  ws: UWSWebSocket,
  rawMessage: ArrayBuffer,
  _isBinary: boolean,
  context: GatewayContext,
  rateLimiter: TokenBucketRateLimiter,
): Promise<void> {
  const session = ws.getUserData();

  // Rate limit check
  if (!rateLimiter.consume(session.id)) {
    log.warn(
      { sessionId: session.id, userId: session.userId },
      'Rate limit exceeded; closing connection',
    );
    ws.send(
      JSON.stringify({
        op: OpCode.DISPATCH,
        t: ServerEventType.ERROR,
        d: { code: 4008, message: 'You are being rate limited' },
        s: ++session.sequence,
      }),
    );
    ws.end(RATE_LIMIT_CLOSE_CODE, 'Rate limited');
    return;
  }

  // Size guard
  if (rawMessage.byteLength > MAX_MESSAGE_SIZE) {
    log.warn(
      { sessionId: session.id, size: rawMessage.byteLength },
      'Message too large; ignoring',
    );
    ws.send(
      JSON.stringify({
        op: OpCode.DISPATCH,
        t: ServerEventType.ERROR,
        d: { code: 4002, message: 'Message too large' },
        s: ++session.sequence,
      }),
    );
    return;
  }

  // Decode buffer to string
  let text: string;
  try {
    text = Buffer.from(rawMessage).toString('utf8');
  } catch (err) {
    log.warn({ err, sessionId: session.id }, 'Failed to decode message buffer');
    return;
  }

  // Parse JSON
  let envelope: { op: number; d?: unknown; t?: string; s?: number };
  try {
    envelope = JSON.parse(text) as { op: number; d?: unknown; t?: string };
  } catch (err) {
    log.warn({ err, sessionId: session.id, text }, 'Malformed JSON from client');
    ws.send(
      JSON.stringify({
        op: OpCode.DISPATCH,
        t: ServerEventType.ERROR,
        d: { code: 4002, message: 'Invalid JSON payload' },
        s: ++session.sequence,
      }),
    );
    return;
  }

  // Validate top-level shape
  if (typeof envelope.op !== 'number') {
    log.warn({ sessionId: session.id, envelope }, 'Missing or invalid op field');
    return;
  }

  session.lastMessageAt = Date.now();

  // Dispatch by opcode
  try {
    switch (envelope.op) {
      case OpCode.HEARTBEAT: {
        handleHeartbeat(ws);
        break;
      }

      case OpCode.IDENTIFY: {
        const d = envelope.d as { token: string; properties?: Record<string, string>; compress?: boolean };
        if (!d || typeof d.token !== 'string') {
          log.warn({ sessionId: session.id }, 'IDENTIFY missing token');
          ws.end(4002, 'Invalid IDENTIFY payload');
          return;
        }
        await handleIdentify(ws, d, context);
        break;
      }

      case OpCode.RESUME: {
        const d = envelope.d as { token: string; sessionId: string; seq: number };
        if (!d || typeof d.token !== 'string' || typeof d.sessionId !== 'string') {
          log.warn({ sessionId: session.id }, 'RESUME missing required fields');
          ws.end(4002, 'Invalid RESUME payload');
          return;
        }
        await handleResume(ws, d, context);
        break;
      }

      case OpCode.PRESENCE_UPDATE: {
        if (!session.authenticated || !session.userId) {
          log.warn({ sessionId: session.id }, 'PRESENCE_UPDATE from unauthenticated session');
          return;
        }
        const d = envelope.d as { status: PresenceStatus; customStatus?: string };
        if (!d || !d.status) return;
        await handlePresenceUpdate(ws, d, context);
        break;
      }

      case OpCode.VOICE_STATE_UPDATE: {
        if (!session.authenticated || !session.userId) return;
        const d = envelope.d as { selfMute: boolean; selfDeaf: boolean };
        await handleVoiceStateUpdate(ws, d, context);
        break;
      }

      case OpCode.REQUEST_GUILD_MEMBERS: {
        if (!session.authenticated || !session.userId) return;
        const d = envelope.d as { guildId: string; query?: string; limit?: number };
        await handleRequestGuildMembers(ws, d, context);
        break;
      }

      default: {
        // Handle typed client events that arrive as op DISPATCH
        if (envelope.op === OpCode.DISPATCH && envelope.t) {
          log.info(
            { sessionId: session.id, eventType: envelope.t, authenticated: session.authenticated },
            'Client dispatch received',
          );
          await handleClientDispatch(ws, envelope.t as ClientEventType, envelope.d, context);
        } else {
          log.debug(
            { sessionId: session.id, op: envelope.op, t: envelope.t },
            'Unknown opcode received; ignoring',
          );
        }
      }
    }
  } catch (err) {
    log.error({ err, sessionId: session.id, op: envelope.op }, 'Unhandled error in message handler');
  }
}

/**
 * Handles HEARTBEAT (op: 1).
 * Responds immediately with HEARTBEAT_ACK and marks the session as acked.
 */
function handleHeartbeat(ws: UWSWebSocket): void {
  const session = ws.getUserData();
  session.heartbeatAcked = true;

  ws.send(
    JSON.stringify({
      op: OpCode.HEARTBEAT_ACK,
      d: {},
    }),
  );
}

/**
 * Handles PRESENCE_UPDATE (op: 3) from an authenticated client.
 */
async function handlePresenceUpdate(
  ws: UWSWebSocket,
  data: { status: PresenceStatus; customStatus?: string },
  context: GatewayContext,
): Promise<void> {
  const session = ws.getUserData();
  const userId = session.userId!;
  const guildIds = [...session.subscribedGuilds];

  const validStatuses: PresenceStatus[] = ['online', 'idle', 'dnd', 'invisible'];
  if (!validStatuses.includes(data.status)) {
    log.warn({ sessionId: session.id, status: data.status }, 'Invalid presence status');
    return;
  }

  session.presence = data.status === 'invisible' ? 'offline' : data.status;

  await context.presenceManager.updatePresence(
    userId,
    data.status,
    guildIds,
    data.customStatus,
  );
}

/**
 * Handles VOICE_STATE_UPDATE (op: 4).
 * Publishes the voice state to the media-signalling service via Redis.
 */
async function handleVoiceStateUpdate(
  ws: UWSWebSocket,
  data: { selfMute: boolean; selfDeaf: boolean },
  context: GatewayContext,
): Promise<void> {
  const session = ws.getUserData();
  const userId = session.userId!;

  // Publish to media signalling service via pub/sub
  await context.pubsub.publish(`voice:user:${userId}`, {
    op: OpCode.DISPATCH,
    t: ServerEventType.VOICE_STATE_UPDATE,
    d: {
      userId,
      channelId: null,
      selfMute: data.selfMute ?? false,
      selfDeaf: data.selfDeaf ?? false,
      serverMute: false,
      serverDeaf: false,
      speaking: false,
    },
  });
}

/**
 * Handles REQUEST_GUILD_MEMBERS (op: 8).
 * Fetches offline member data and streams it back to the client.
 */
async function handleRequestGuildMembers(
  ws: UWSWebSocket,
  data: { guildId: string; query?: string; limit?: number },
  context: GatewayContext,
): Promise<void> {
  const session = ws.getUserData();
  if (!data.guildId) return;

  // Verify the session is subscribed to this guild
  if (!session.subscribedGuilds.has(data.guildId)) {
    log.warn(
      { sessionId: session.id, guildId: data.guildId },
      'REQUEST_GUILD_MEMBERS for non-subscribed guild',
    );
    return;
  }

  try {
    const url = `${context.apiBaseUrl}/internal/guilds/${data.guildId}/members?` +
      new URLSearchParams({
        query: data.query ?? '',
        limit: String(Math.min(data.limit ?? 100, 1000)),
      });

    const response = await fetch(url, {
      headers: { 'X-Internal-Token': context.config.JWT_SECRET },
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) return;

    const body = (await response.json()) as { members: unknown[] };

    ws.send(
      JSON.stringify({
        op: OpCode.DISPATCH,
        t: 'GUILD_MEMBERS_CHUNK',
        d: {
          guildId: data.guildId,
          members: body.members,
          chunkIndex: 0,
          chunkCount: 1,
        },
        s: ++session.sequence,
      }),
    );
  } catch (err) {
    log.warn({ err, guildId: data.guildId }, 'Failed to fetch guild members');
  }
}

/**
 * Handles client-sent DISPATCH events (op: 0, t: ClientEventType.*).
 * These are events the client wants the server to process and fan-out.
 */
async function handleClientDispatch(
  ws: UWSWebSocket,
  eventType: ClientEventType,
  data: unknown,
  context: GatewayContext,
): Promise<void> {
  const session = ws.getUserData();

  if (!session.authenticated || !session.userId) {
    log.warn({ sessionId: session.id, eventType }, 'Dispatch from unauthenticated session');
    // Send error back so client doesn't hang forever
    ws.send(
      JSON.stringify({
        op: OpCode.DISPATCH,
        t: ServerEventType.ERROR,
        d: { code: 4003, message: 'Not authenticated' },
        s: ++session.sequence,
      }),
    );
    return;
  }

  switch (eventType) {
    case ClientEventType.SUBSCRIBE_GUILD: {
      const d = data as { guildId: string };
      if (!d.guildId) return;
      context.subscriptionManager.subscribe(session.id, `guild:${d.guildId}`);
      session.subscribedGuilds.add(d.guildId);

      // Persist to Redis for RESUME replay
      const redis = context.pubsub.getPublisher();
      redis.sadd(`swiip:session_guilds:${session.id}`, d.guildId).catch(() => {});

      // Send current presence for all members of this guild
      await sendGuildPresenceSnapshot(ws, d.guildId, context);
      break;
    }

    case ClientEventType.UNSUBSCRIBE_GUILD: {
      const d = data as { guildId: string };
      if (!d.guildId) return;
      context.subscriptionManager.unsubscribe(session.id, `guild:${d.guildId}`);
      session.subscribedGuilds.delete(d.guildId);

      // Remove from Redis
      const redis2 = context.pubsub.getPublisher();
      redis2.srem(`swiip:session_guilds:${session.id}`, d.guildId).catch(() => {});
      break;
    }

    case ClientEventType.VOICE_JOIN: {
      const d = data as { channelId: string };
      log.info(
        { userId: session.userId, channelId: d?.channelId },
        'VOICE_JOIN: handler entered',
      );
      if (!d.channelId) {
        log.warn({ userId: session.userId }, 'VOICE_JOIN: missing channelId');
        return;
      }
      const mediaBaseUrl = context.mediaBaseUrl;
      const apiBase = context.apiBaseUrl;

      const sendVoiceError = (message: string) => {
        log.warn({ userId: session.userId, channelId: d.channelId }, `VOICE_JOIN: sending error → ${message}`);
        ws.send(
          JSON.stringify({
            op: OpCode.DISPATCH,
            t: ServerEventType.ERROR,
            d: { code: 4010, message: `Voice join failed: ${message}` },
            s: ++session.sequence,
          }),
        );
      };

      try {
        // 1. Resolve channel's guild
        const channelUrl = `${apiBase}/internal/channels/${d.channelId}`;
        log.info({ url: channelUrl }, 'VOICE_JOIN: fetching channel');
        const channelResponse = await fetch(channelUrl, {
          headers: { 'X-Internal-Token': context.config.JWT_SECRET },
          signal: AbortSignal.timeout(3_000),
        });
        if (!channelResponse.ok) {
          const errBody = await channelResponse.text().catch(() => '');
          log.warn({ channelId: d.channelId, status: channelResponse.status, body: errBody }, 'VOICE_JOIN: channel lookup failed');
          sendVoiceError('Channel not found');
          return;
        }
        const channelData = (await channelResponse.json()) as { guildId: string };
        log.info({ channelId: d.channelId, guildId: channelData.guildId }, 'VOICE_JOIN: channel resolved');

        // 2. Get LiveKit token from media-signalling
        const joinUrl = `${mediaBaseUrl}/rooms/${channelData.guildId}/${d.channelId}/join`;
        log.info({ url: joinUrl }, 'VOICE_JOIN: requesting LiveKit token');
        const joinResponse = await fetch(joinUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': context.config.JWT_SECRET,
          },
          body: JSON.stringify({
            userId: session.userId,
            username: session.userId,
          }),
          signal: AbortSignal.timeout(5_000),
        });
        if (!joinResponse.ok) {
          const body = await joinResponse.text().catch(() => '');
          log.warn({ channelId: d.channelId, status: joinResponse.status, body }, 'VOICE_JOIN: media-signalling join failed');
          sendVoiceError('Media service unavailable');
          return;
        }

        const joinResult = (await joinResponse.json()) as {
          token: string;
          endpoint: string;
        };

        log.info(
          { userId: session.userId, channelId: d.channelId, guildId: channelData.guildId, endpoint: joinResult.endpoint },
          'VOICE_JOIN: token issued, sending VOICE_SERVER_UPDATE',
        );

        // 3. Send VOICE_SERVER_UPDATE with LiveKit credentials
        await context.pubsub.publish(`guild:${channelData.guildId}`, {
          op: OpCode.DISPATCH,
          t: ServerEventType.VOICE_STATE_UPDATE,
          d: {
            userId: session.userId,
            channelId: d.channelId,
            guildId: channelData.guildId,
            selfMute: false,
            selfDeaf: false,
            serverMute: false,
            serverDeaf: false,
            speaking: false,
          },
        });

        ws.send(
          JSON.stringify({
            op: OpCode.DISPATCH,
            t: ServerEventType.VOICE_SERVER_UPDATE,
            d: {
              guildId: channelData.guildId,
              token: joinResult.token,
              endpoint: joinResult.endpoint,
            },
            s: ++session.sequence,
          }),
        );
        log.info({ userId: session.userId, channelId: d.channelId }, 'VOICE_JOIN: VOICE_SERVER_UPDATE sent');
      } catch (err) {
        log.error({ err, channelId: d.channelId }, 'VOICE_JOIN: unexpected error');
        sendVoiceError('Unexpected error');
      }
      break;
    }

    case ClientEventType.VOICE_LEAVE: {
      // Client-side disconnects from LiveKit directly.
      // The LiveKit webhook (participant_left) handles cleanup.
      // We just publish the intent so the gateway can optimistically update.
      const userId = session.userId!;
      const guildIds = [...session.subscribedGuilds];
      for (const guildId of guildIds) {
        await context.pubsub.publish(`guild:${guildId}`, {
          op: OpCode.DISPATCH,
          t: ServerEventType.VOICE_STATE_UPDATE,
          d: {
            userId,
            channelId: null,
            guildId,
            selfMute: false,
            selfDeaf: false,
            serverMute: false,
            serverDeaf: false,
            speaking: false,
          },
        });
      }
      break;
    }

    case ClientEventType.TYPING_START: {
      const d = data as { channelId: string };
      if (!d.channelId) return;
      // Publish typing event to the channel topic
      await context.pubsub.publish(`channel:${d.channelId}`, {
        op: OpCode.DISPATCH,
        t: ServerEventType.TYPING_START,
        d: {
          channelId: d.channelId,
          userId: session.userId,
          timestamp: Date.now(),
        },
      });
      break;
    }

    case ClientEventType.READ_STATE_UPDATE: {
      const d = data as { channelId: string; lastReadMessageId: string };
      if (!d.channelId || !d.lastReadMessageId) return;
      // Forward to API service for persistence
      await forwardToApi(context, `/internal/read-state`, {
        userId: session.userId,
        channelId: d.channelId,
        lastReadMessageId: d.lastReadMessageId,
      });
      break;
    }

    default:
      // Other client dispatch events (MESSAGE_CREATE, etc.) should be sent
      // directly to the API via REST, not the gateway. Log and discard.
      log.debug(
        { sessionId: session.id, eventType },
        'Received client dispatch event (forward to API)',
      );
  }
}

/**
 * Sends a snapshot of all guild member presence statuses to a newly-subscribed client.
 */
async function sendGuildPresenceSnapshot(
  ws: UWSWebSocket,
  guildId: string,
  context: GatewayContext,
): Promise<void> {
  const session = ws.getUserData();
  try {
    const url = `${context.apiBaseUrl}/internal/guilds/${guildId}/member-ids`;
    const response = await fetch(url, {
      headers: { 'X-Internal-Token': context.config.JWT_SECRET },
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) return;

    const { memberIds } = (await response.json()) as { memberIds: string[] };
    const presenceMap = await context.presenceManager.bulkGetPresence(memberIds);

    for (const [userId, presence] of presenceMap) {
      ws.send(
        JSON.stringify({
          op: OpCode.DISPATCH,
          t: ServerEventType.PRESENCE_UPDATE,
          d: {
            userId,
            status: presence.status,
            customStatus: presence.customStatus,
            activities: presence.activities,
          },
          s: ++session.sequence,
        }),
      );
    }
  } catch (err) {
    log.debug({ err, guildId }, 'Failed to send guild presence snapshot');
  }
}

/**
 * Forwards data to the internal API service.
 */
async function forwardToApi(
  context: GatewayContext,
  path: string,
  body: unknown,
): Promise<void> {
  try {
    await fetch(`${context.apiBaseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': context.config.JWT_SECRET,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3_000),
    });
  } catch (err) {
    log.warn({ err, path }, 'Failed to forward to API');
  }
}
