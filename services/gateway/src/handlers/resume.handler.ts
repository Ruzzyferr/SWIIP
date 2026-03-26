import type { UWSWebSocket, GatewayContext } from '../types';
import { OpCode, ServerEventType } from '@constchat/protocol';
import { verifyToken, JwtVerificationError } from '../utils/jwt';
import { createSessionLogger } from '../utils/logger';

interface ResumeData {
  token: string;
  sessionId: string;
  seq: number;
}

interface StoredSessionData {
  id: string;
  userId: string;
  sequence: string;
  connectedAt: string;
  remoteAddress: string;
  /** Unix ms timestamp when the session was last active (set on disconnect). */
  disconnectedAt?: string;
}

/**
 * Maximum number of entries to read from each stream during replay.
 * This bounds the work done per-resume to prevent slow reconnects.
 */
const MAX_REPLAY_PER_STREAM = 500;

/**
 * Maximum total events to replay across all streams.
 * If exceeded, the session is not resumable (client must re-IDENTIFY).
 */
const MAX_REPLAY_TOTAL = 2000;

/**
 * Handles the RESUME opcode (op: 6).
 *
 * Flow:
 *  1. Verify the provided JWT.
 *  2. Validate that the target sessionId exists in Redis.
 *  3. Confirm the session belongs to the authenticated user.
 *  4. Read the session's disconnect timestamp from Redis.
 *  5. Replay missed events from Redis Streams (guild + user streams) since disconnect.
 *  6. Restore topic subscriptions.
 *  7. Send replayed events in chronological order, then RESUMED.
 *
 * Delivery guarantees:
 *  - Events are replayed at-least-once from streams written by EventPublisherService.
 *  - Events older than the stream's MAXLEN (~1000 per topic) cannot be replayed.
 *  - If too many events are missed, the session is marked non-resumable.
 *  - Clients must deduplicate by event nonce/ID if needed.
 */
export async function handleResume(
  ws: UWSWebSocket,
  data: ResumeData,
  context: GatewayContext,
): Promise<void> {
  const session = ws.getUserData();
  const log = createSessionLogger(session.id);

  // Prevent resume on already-authenticated session
  if (session.authenticated) {
    log.warn('RESUME on already-authenticated session');
    sendInvalidSession(ws, false);
    return;
  }

  // 1. Verify the JWT token
  let userId: string;
  try {
    const payload = verifyToken(data.token, context.config.JWT_SECRET);
    userId = payload.sub;
  } catch (err) {
    if (err instanceof JwtVerificationError) {
      log.warn({ code: err.code }, 'RESUME failed: invalid token');
      sendInvalidSession(ws, false);
      ws.end(4004, 'Authentication failed');
      return;
    }
    log.error({ err }, 'Unexpected error verifying token during RESUME');
    ws.end(4000, 'Internal error');
    return;
  }

  // 2. Look up the previous session in Redis
  const redis = context.pubsub.getPublisher();
  const sessionKey = `constchat:sessions:${data.sessionId}`;

  let storedSession: StoredSessionData | null;
  try {
    const raw = await redis.hgetall(sessionKey);
    if (!raw || !raw['id']) {
      storedSession = null;
    } else {
      storedSession = raw as unknown as StoredSessionData;
    }
  } catch (err) {
    log.error({ err }, 'Redis error fetching session for RESUME');
    sendInvalidSession(ws, false);
    return;
  }

  // 3. Validate ownership and state
  if (!storedSession || storedSession.userId !== userId) {
    log.warn(
      { requestedSession: data.sessionId, userId },
      'RESUME denied: session not found or userId mismatch',
    );
    sendInvalidSession(ws, false);
    ws.end(4009, 'Invalid session');
    return;
  }

  // Prevent resuming a session that's still marked as active (no disconnectedAt).
  // This could happen if the client opens a second connection and tries to resume
  // a session that hasn't been properly torn down yet.
  if (!storedSession.disconnectedAt) {
    log.warn(
      { requestedSession: data.sessionId, userId },
      'RESUME denied: session has no disconnectedAt (may still be active)',
    );
    // Mark as resumable=true so the client can retry after the old session closes
    sendInvalidSession(ws, true);
    return;
  }

  const lastServerSeq = parseInt(storedSession.sequence, 10);
  const clientSeq = data.seq;

  // Determine the disconnect timestamp for stream replay.
  // We use this as the lower bound for XRANGE instead of sequence numbers,
  // because stream entry IDs are Redis-generated timestamps.
  let disconnectedAt = storedSession.disconnectedAt
    ? parseInt(storedSession.disconnectedAt, 10)
    : 0;

  // If disconnectedAt is missing or zero, the close handler may have failed.
  // Fall back to "5 minutes ago" to bound the replay window and avoid
  // replaying the entire stream history.
  if (disconnectedAt <= 0) {
    disconnectedAt = Date.now() - 5 * 60 * 1000;
    log.warn({ userId }, 'No disconnectedAt found; falling back to 5-minute replay window');
  }

  log.info(
    { userId, sessionId: data.sessionId, clientSeq, lastServerSeq, disconnectedAt },
    'Resuming session',
  );

  // 4. Determine which streams to read from
  const guildSetKey = `constchat:session_guilds:${data.sessionId}`;
  let guildIds: string[];
  try {
    guildIds = await redis.smembers(guildSetKey);
  } catch {
    guildIds = [];
  }

  // 5. Replay missed events from Redis Streams
  const missedEvents = await replayMissedEvents(
    userId,
    guildIds,
    disconnectedAt,
    context,
    log,
  );

  // If too many events missed, the session is not resumable
  if (missedEvents === null) {
    log.warn({ userId }, 'Too many missed events; session not resumable');
    sendInvalidSession(ws, false);
    ws.end(4009, 'Session expired');
    return;
  }

  // 6. Update current session to inherit the resumed state
  session.userId = userId;
  session.authenticated = true;
  session.sequence = lastServerSeq;

  // Re-register subscriptions for the resumed session
  await restoreSubscriptions(data.sessionId, session.id, context, userId, guildIds);

  // 7. Send all missed events in chronological order
  for (const eventJson of missedEvents) {
    try {
      // Re-assign sequence numbers for the replayed events
      session.sequence += 1;
      const parsed = JSON.parse(eventJson);
      parsed.s = session.sequence;
      ws.send(JSON.stringify(parsed));
    } catch (err) {
      log.warn({ err }, 'Failed to send missed event during RESUME');
    }
  }

  // 8. Send RESUMED
  ws.send(
    JSON.stringify({
      op: OpCode.DISPATCH,
      t: ServerEventType.RESUMED,
      d: { replayedCount: missedEvents.length },
      s: ++session.sequence,
    }),
  );

  // 9. Update the session record in Redis (new session ID, updated sequence)
  try {
    const pipeline = redis.pipeline();
    // Store new session data
    pipeline.hset(`constchat:sessions:${session.id}`, {
      id: session.id,
      userId,
      sequence: String(session.sequence),
      connectedAt: String(Date.now()),
      remoteAddress: session.remoteAddress,
    });
    pipeline.expire(`constchat:sessions:${session.id}`, 86_400);
    // Store guild subscriptions for the new session
    if (guildIds.length > 0) {
      pipeline.sadd(`constchat:session_guilds:${session.id}`, ...guildIds);
      pipeline.expire(`constchat:session_guilds:${session.id}`, 86_400);
    }
    // Clean up old session keys
    pipeline.del(`constchat:sessions:${data.sessionId}`);
    pipeline.del(`constchat:session_guilds:${data.sessionId}`);
    await pipeline.exec();
  } catch (err) {
    log.warn({ err }, 'Failed to update session in Redis after resume');
  }

  log.info(
    { userId, missedCount: missedEvents.length, newSequence: session.sequence },
    'Session resumed successfully',
  );
}

/**
 * Reads missed events from Redis Streams for all topics the session was subscribed to.
 *
 * Stream topology:
 *   constchat:stream:guild:{guildId}  — guild-scoped events
 *   constchat:stream:user:{userId}    — personal events
 *
 * Returns null if too many events are missed (session is not resumable).
 * Returns sorted array of event JSON strings on success.
 */
async function replayMissedEvents(
  userId: string,
  guildIds: string[],
  disconnectedAtMs: number,
  context: GatewayContext,
  log: ReturnType<typeof createSessionLogger>,
): Promise<string[] | null> {
  const redis = context.pubsub.getPublisher();

  // Build list of streams to read from
  const streamKeys: string[] = [
    `constchat:stream:user:${userId}`,
    ...guildIds.map((id) => `constchat:stream:guild:${id}`),
  ];

  // Use the disconnect timestamp as the lower bound for XRANGE.
  // Redis stream IDs are formatted as "{milliseconds}-{seq}".
  // We want entries strictly after the disconnect time.
  const startId = disconnectedAtMs > 0 ? `${disconnectedAtMs}-0` : '0-0';

  interface StreamEntry {
    ts: number;
    data: string;
  }

  const allEntries: StreamEntry[] = [];

  for (const streamKey of streamKeys) {
    try {
      const entries = await redis.xrange(
        streamKey,
        startId,
        '+',
        'COUNT',
        String(MAX_REPLAY_PER_STREAM),
      );

      if (!entries || entries.length === 0) continue;

      for (const [entryId, fields] of entries) {
        // Stream fields are stored as flat array: ['type', 'X', 'data', '{json}', 'ts', '123']
        const dataIdx = fields.indexOf('data');
        const tsIdx = fields.indexOf('ts');

        if (dataIdx !== -1 && fields[dataIdx + 1]) {
          // Use the stream entry ID timestamp if 'ts' field is missing
          const entryTs = tsIdx !== -1 && fields[tsIdx + 1]
            ? parseInt(fields[tsIdx + 1] as string, 10)
            : parseInt(entryId.split('-')[0]!, 10);

          // Only include events strictly after disconnect
          if (entryTs > disconnectedAtMs) {
            allEntries.push({
              ts: entryTs,
              data: fields[dataIdx + 1] as string,
            });
          }
        }
      }
    } catch (err) {
      // Stream may not exist; this is expected for topics with no recent events
      log.debug({ err, streamKey }, 'Stream read failed during replay (non-fatal)');
    }
  }

  // Check if too many events to replay
  if (allEntries.length > MAX_REPLAY_TOTAL) {
    return null;
  }

  // Sort by timestamp (chronological order)
  allEntries.sort((a, b) => a.ts - b.ts);

  return allEntries.map((e) => e.data);
}

/**
 * Restores topic subscriptions for a resumed session.
 * Uses the guild IDs already fetched from Redis (avoids redundant lookup).
 */
async function restoreSubscriptions(
  oldSessionId: string,
  newSessionId: string,
  context: GatewayContext,
  userId: string,
  guildIds: string[],
): Promise<void> {
  const redis = context.pubsub.getPublisher();
  const log = createSessionLogger(newSessionId, userId);

  try {
    // Restore guild subscriptions
    for (const guildId of guildIds) {
      context.subscriptionManager.subscribe(newSessionId, `guild:${guildId}`);
      const ws = context.subscriptionManager.getSessionSocket(newSessionId);
      const session = ws?.getUserData();
      if (session) session.subscribedGuilds.add(guildId);
    }

    // Subscribe to personal user topic
    context.subscriptionManager.subscribe(newSessionId, `user:${userId}`);

    // Update presence
    await context.presenceManager.onConnect(userId, newSessionId, guildIds);

    // Update user sessions set
    const userSessionsKey = `constchat:user_sessions:${userId}`;
    const pipeline = redis.pipeline();
    pipeline.srem(userSessionsKey, oldSessionId);
    pipeline.sadd(userSessionsKey, newSessionId);
    pipeline.expire(userSessionsKey, 86_400);
    await pipeline.exec();

    log.debug(
      { guildCount: guildIds.length },
      'Subscriptions restored for resumed session',
    );
  } catch (err) {
    log.warn({ err }, 'Failed to restore subscriptions for resumed session');
  }
}

function sendInvalidSession(ws: UWSWebSocket, resumable: boolean): void {
  ws.send(
    JSON.stringify({
      op: OpCode.INVALID_SESSION,
      d: { resumable },
    }),
  );
}
