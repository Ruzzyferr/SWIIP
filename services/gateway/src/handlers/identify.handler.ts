import type { UWSWebSocket, GatewayContext, ClientSession } from '../types';
import { OpCode, ServerEventType, type GuildPayload, type DMChannelPayload, type UserPayload } from '@constchat/protocol';
import { verifyToken, JwtVerificationError } from '../utils/jwt';
import { createSessionLogger } from '../utils/logger';

interface IdentifyData {
  token: string;
  properties?: {
    os?: string;
    browser?: string;
    device?: string;
  };
  compress?: boolean;
  largeThreshold?: number;
}

interface VoiceStatePayload {
  userId: string;
  channelId: string;
  guildId: string;
  selfMute: boolean;
  selfDeaf: boolean;
  selfVideo?: boolean;
  screenShare?: boolean;
  serverMute: boolean;
  serverDeaf: boolean;
  speaking: boolean;
}

interface ReadStatePayload {
  channelId: string;
  lastReadMessageId: string | null;
  mentionCount: number;
}

interface ReadyPayload {
  user: UserPayload;
  guilds: GuildPayload[];
  dms: DMChannelPayload[];
  voiceStates: VoiceStatePayload[];
  readStates: ReadStatePayload[];
  sessionId: string;
  resumeUrl: string;
}

/**
 * Handles the IDENTIFY opcode (op: 2).
 *
 * Flow:
 *  1. Verify the JWT token from the data payload.
 *  2. Prevent double-IDENTIFY on the same connection.
 *  3. Fetch user profile + guild/DM list from the internal API (or Redis cache).
 *  4. Subscribe the session to guild:{id} and user:{userId} topics.
 *  5. Register presence as online.
 *  6. Send the READY dispatch event.
 */
export async function handleIdentify(
  ws: UWSWebSocket,
  data: IdentifyData,
  context: GatewayContext,
): Promise<void> {
  const session = ws.getUserData();
  const log = createSessionLogger(session.id);

  // Prevent re-identification
  if (session.authenticated) {
    log.warn('Duplicate IDENTIFY on already-authenticated connection');
    sendError(ws, session, 4005, 'Already authenticated');
    return;
  }

  // Rate limit IDENTIFY attempts: max 3 per connection
  session.identifyAttempts = (session.identifyAttempts ?? 0) + 1;
  if (session.identifyAttempts > 3) {
    log.warn('Too many IDENTIFY attempts, closing connection');
    ws.end(4029, 'Too many authentication attempts');
    return;
  }

  // 1. Verify JWT
  let userId: string;
  try {
    const payload = verifyToken(data.token, context.config.JWT_SECRET);
    userId = payload.sub;
  } catch (err) {
    if (err instanceof JwtVerificationError) {
      log.warn({ code: err.code }, 'IDENTIFY failed: invalid token');
      sendInvalidSession(ws, session, false);
      ws.end(4004, 'Authentication failed');
      return;
    }
    log.error({ err }, 'Unexpected error verifying token');
    ws.end(4000, 'Internal error');
    return;
  }

  log.info({ userId }, 'Identifying session');

  // 2. Fetch user data from API or Redis cache
  let readyPayload: ReadyPayload;
  try {
    readyPayload = await fetchReadyPayload(userId, session.id, context);
  } catch (err) {
    log.error({ err, userId }, 'Failed to fetch READY payload');
    ws.end(4000, 'Internal error fetching user data');
    return;
  }

  // 3. Update session state
  session.userId = userId;
  session.authenticated = true;
  if (data.compress === true) {
    session.compress = true;
  }

  // 4. Store session in Redis
  try {
    await storeSessionInRedis(session, userId, context);
  } catch (err) {
    log.error({ err, userId }, 'Failed to store session in Redis');
    // Non-fatal: continue
  }

  // 5. Subscribe to personal events
  context.subscriptionManager.subscribe(session.id, `user:${userId}`);
  session.subscribedDMs = new Set<string>();
  session.subscribedGuilds = new Set<string>();

  // 6. Subscribe to each guild
  const guildIds: string[] = [];
  for (const guild of readyPayload.guilds) {
    context.subscriptionManager.subscribe(session.id, `guild:${guild.id}`);
    session.subscribedGuilds.add(guild.id);
    guildIds.push(guild.id);
  }

  // 7. Subscribe to each DM channel
  for (const dm of readyPayload.dms) {
    context.subscriptionManager.subscribe(session.id, `dm:${dm.id}`);
    session.subscribedDMs.add(dm.id);
  }

  // 8. Persist guild subscription set to Redis (needed for RESUME replay)
  try {
    if (guildIds.length > 0) {
      const redis = context.pubsub.getPublisher();
      const guildSetKey = `swiip:session_guilds:${session.id}`;
      const pipeline = redis.pipeline();
      pipeline.sadd(guildSetKey, ...guildIds);
      pipeline.expire(guildSetKey, 86_400);
      await pipeline.exec();
    }
  } catch (err) {
    log.warn({ err, userId }, 'Failed to persist guild subscriptions to Redis');
  }

  // 9. Update presence
  try {
    await context.presenceManager.onConnect(userId, session.id, guildIds);
  } catch (err) {
    log.warn({ err, userId }, 'Failed to update presence on connect');
  }

  // 10. Send READY
  const readyEvent = JSON.stringify({
    op: OpCode.DISPATCH,
    t: ServerEventType.READY,
    d: readyPayload,
    s: ++session.sequence,
  });

  ws.send(readyEvent);
  log.info({ userId, guildCount: guildIds.length }, 'Session identified and READY sent');
}

/**
 * Fetches the READY payload for a user.
 * Checks Redis cache first, falls back to the internal API.
 */
async function fetchReadyPayload(
  userId: string,
  sessionId: string,
  context: GatewayContext,
): Promise<ReadyPayload> {
  const redis = context.pubsub.getPublisher();
  const cacheKey = `swiip:ready_cache:${userId}`;

  // Try Redis cache for user/guild/dm data (populated by the API service after login)
  let body: { user: UserPayload; guilds: GuildPayload[]; dms: DMChannelPayload[]; readStates?: ReadStatePayload[] };
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      body = { user: parsed.user, guilds: parsed.guilds, dms: parsed.dms, readStates: parsed.readStates };
    } else {
      throw new Error('cache miss');
    }
  } catch {
    // Fall back to internal API
    const url = `${context.apiBaseUrl}/internal/ready/${userId}`;
    const response = await fetch(url, {
      headers: {
        'X-Internal-Token': context.config.JWT_SECRET,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      throw new Error(`Internal API returned ${response.status} for ready payload`);
    }

    body = (await response.json()) as typeof body;

    // Cache user/guild/dm data for 30s (voice states are always fetched fresh)
    try {
      await redis.set(cacheKey, JSON.stringify(body), 'EX', 30);
    } catch {
      // Non-fatal
    }
  }

  // Always fetch voice states fresh from Redis (not cached)
  const voiceStates: VoiceStatePayload[] = [];
  try {
    if (body.guilds.length > 0) {
      const pipeline = redis.pipeline();
      for (const guild of body.guilds) {
        pipeline.hgetall(`swiip:voice_states:${guild.id}`);
      }
      const results = await pipeline.exec();
      if (results) {
        for (const [err, result] of results) {
          if (err || !result) continue;
          const hash = result as Record<string, string>;
          for (const value of Object.values(hash)) {
            try {
              voiceStates.push(JSON.parse(value));
            } catch {
              // skip malformed entries
            }
          }
        }
      }
    }
  } catch {
    // Non-fatal — voice states just won't be pre-populated
  }

  const payload: ReadyPayload = {
    user: body.user,
    guilds: body.guilds,
    dms: body.dms,
    voiceStates,
    readStates: body.readStates ?? [],
    sessionId,
    resumeUrl: buildResumeUrl(context),
  };

  return payload;
}

async function storeSessionInRedis(
  session: ClientSession,
  userId: string,
  context: GatewayContext,
): Promise<void> {
  const redis = context.pubsub.getPublisher();
  const sessionKey = `swiip:sessions:${session.id}`;
  const userSessionsKey = `swiip:user_sessions:${userId}`;

  const pipeline = redis.pipeline();
  pipeline.hset(sessionKey, {
    id: session.id,
    userId,
    socketId: session.socketId,
    presence: session.presence,
    sequence: String(session.sequence),
    connectedAt: String(Date.now()),
    remoteAddress: session.remoteAddress,
  });
  pipeline.expire(sessionKey, 86_400); // 24h
  pipeline.sadd(userSessionsKey, session.id);
  pipeline.expire(userSessionsKey, 86_400);
  await pipeline.exec();
}

function buildResumeUrl(context: GatewayContext): string {
  // Use the validated GATEWAY_PUBLIC_URL from config (required field in GatewayConfig).
  // Previously this read process.env directly and fell back to localhost, which
  // could cause clients to attempt resuming to ws://localhost in production.
  return context.config.GATEWAY_PUBLIC_URL;
}

function sendError(ws: UWSWebSocket, session: ClientSession, code: number, message: string): void {
  ws.send(
    JSON.stringify({
      op: OpCode.DISPATCH,
      t: ServerEventType.ERROR,
      d: { code, message },
      s: ++session.sequence,
    }),
  );
}

function sendInvalidSession(
  ws: UWSWebSocket,
  session: ClientSession,
  resumable: boolean,
): void {
  ws.send(
    JSON.stringify({
      op: OpCode.INVALID_SESSION,
      d: { resumable },
    }),
  );
}
