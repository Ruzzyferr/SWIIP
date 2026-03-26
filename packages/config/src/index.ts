import { z, ZodError } from 'zod';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wraps a Zod schema parse so that validation failures produce a clear,
 * human-readable error message listing every missing or invalid field rather
 * than throwing a raw ZodError.
 */
function parseEnv<S extends z.ZodTypeAny>(schema: S, env: NodeJS.ProcessEnv): z.output<S> {
  try {
    return schema.parse(env);
  } catch (err) {
    if (err instanceof ZodError) {
      const issues = err.issues
        .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
        .join('\n');
      throw new Error(`[constchat/config] Invalid environment variables:\n${issues}`);
    }
    throw err;
  }
}

const nodeEnvSchema = z.enum(['development', 'test', 'production']).default('development');
const logLevelSchema = z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info');

// ---------------------------------------------------------------------------
// API service configuration
// ---------------------------------------------------------------------------

const apiConfigSchema = z.object({
  /** TCP port the HTTP server will bind to. */
  PORT: z
    .string()
    .default('4000')
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(1).max(65535)),

  /** PostgreSQL connection string. */
  DATABASE_URL: z.string().url(),

  /** Redis connection string used for sessions, pub/sub and rate-limiting. */
  REDIS_URL: z.string().url(),

  /** Secret for signing short-lived access JWTs. Min 32 chars. */
  JWT_SECRET: z.string().min(32),

  /** Secret for signing long-lived refresh JWTs. Min 32 chars. */
  JWT_REFRESH_SECRET: z.string().min(32),

  /** Access token expiry string understood by the `ms` package, e.g. "15m". */
  JWT_ACCESS_EXPIRY: z.string().default('15m'),

  /** Refresh token expiry string, e.g. "30d". */
  JWT_REFRESH_EXPIRY: z.string().default('30d'),

  /** NATS server URL for inter-service messaging. Optional if NATS is not deployed. */
  NATS_URL: z.string().url().optional(),

  /** S3-compatible endpoint URL (MinIO, Cloudflare R2, etc.). Optional if uploads are disabled. */
  S3_ENDPOINT: z.string().url().optional(),

  /** S3 bucket name for media and attachments. */
  S3_BUCKET: z.string().min(1).optional(),

  /** S3 access key ID. */
  S3_ACCESS_KEY: z.string().min(1).optional(),

  /** S3 secret access key. */
  S3_SECRET_KEY: z.string().min(1).optional(),

  /** S3 region (some providers require a specific value, e.g. "auto"). */
  S3_REGION: z.string().default('us-east-1'),

  /** Meilisearch HTTP endpoint for full-text message search. Optional if search is disabled. */
  MEILISEARCH_HOST: z.string().url().optional(),

  /** Meilisearch API key. */
  MEILISEARCH_KEY: z.string().min(1).optional(),

  /** Sentry DSN for error tracking. Optional in non-production. */
  SENTRY_DSN: z.string().url().optional(),

  NODE_ENV: nodeEnvSchema,
  LOG_LEVEL: logLevelSchema,

  /**
   * Allowed CORS origin(s). Accepts a single origin string or a
   * comma-separated list, e.g. "https://swiip.app,https://www.swiip.app".
   */
  CORS_ORIGIN: z.string().default('*'),

  /** Maximum file upload size in megabytes. */
  MAX_UPLOAD_SIZE_MB: z
    .string()
    .default('100')
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(1).max(2048)),
});

export type ApiConfig = z.infer<typeof apiConfigSchema>;

/**
 * Parses and validates environment variables for the API service.
 *
 * @example
 * import { parseApiConfig } from '@constchat/config';
 * const config = parseApiConfig(process.env);
 */
export function parseApiConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return parseEnv(apiConfigSchema, env);
}

// ---------------------------------------------------------------------------
// Gateway service configuration
// ---------------------------------------------------------------------------

const gatewayConfigSchema = z.object({
  /** TCP port the WebSocket server will bind to. */
  PORT: z
    .string()
    .default('4001')
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(1).max(65535)),

  /** Redis connection string for gateway session state and pub/sub. */
  REDIS_URL: z.string().url(),

  /** Secret for verifying access JWTs issued by the API. Must match API JWT_SECRET. */
  JWT_SECRET: z.string().min(32),

  /** NATS server URL for broadcasting gateway events to other services. Optional if NATS is not deployed. */
  NATS_URL: z.string().url().optional(),

  /**
   * Maximum number of simultaneous WebSocket connections this instance will
   * accept before rejecting new connections. 0 = no limit.
   */
  MAX_CONNECTIONS: z
    .string()
    .default('10000')
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(0)),

  /** Interval in milliseconds between server-sent heartbeat requests. */
  HEARTBEAT_INTERVAL: z
    .string()
    .default('41250')
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(1000)),

  /**
   * Time in milliseconds the gateway will wait for a heartbeat response
   * before considering the connection dead and closing it.
   */
  HEARTBEAT_TIMEOUT: z
    .string()
    .default('20000')
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(1000)),

  NODE_ENV: nodeEnvSchema,
  LOG_LEVEL: logLevelSchema,
});

export type GatewayConfig = z.infer<typeof gatewayConfigSchema>;

/**
 * Parses and validates environment variables for the Gateway service.
 *
 * @example
 * import { parseGatewayConfig } from '@constchat/config';
 * const config = parseGatewayConfig(process.env);
 */
export function parseGatewayConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  return parseEnv(gatewayConfigSchema, env);
}

// ---------------------------------------------------------------------------
// Media signalling service configuration
// ---------------------------------------------------------------------------

const mediaSignallingConfigSchema = z.object({
  PORT: z
    .string()
    .default('4002')
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(1).max(65535)),

  REDIS_URL: z.string().url(),
  NATS_URL: z.string().url().optional(),

  /** JWT secret shared with the API to validate media session tokens. */
  JWT_SECRET: z.string().min(32),

  /** Comma-separated list of STUN server URLs. */
  STUN_SERVERS: z
    .string()
    .default('stun:stun.l.google.com:19302')
    .transform((v) => v.split(',').map((s) => s.trim())),

  /** Comma-separated list of TURN server URLs (optional). */
  TURN_SERVERS: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').map((s) => s.trim()) : [])),

  TURN_USERNAME: z.string().optional(),
  TURN_CREDENTIAL: z.string().optional(),

  NODE_ENV: nodeEnvSchema,
  LOG_LEVEL: logLevelSchema,
});

export type MediaSignallingConfig = z.infer<typeof mediaSignallingConfigSchema>;

export function parseMediaSignallingConfig(
  env: NodeJS.ProcessEnv = process.env,
): MediaSignallingConfig {
  return parseEnv(mediaSignallingConfigSchema, env);
}

// ---------------------------------------------------------------------------
// Workers service configuration
// ---------------------------------------------------------------------------

const workersConfigSchema = z.object({
  REDIS_URL: z.string().url(),
  NATS_URL: z.string().url(),
  DATABASE_URL: z.string().url(),

  /** Number of concurrent worker processes to spawn. */
  CONCURRENCY: z
    .string()
    .default('5')
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(1).max(100)),

  SENTRY_DSN: z.string().url().optional(),

  NODE_ENV: nodeEnvSchema,
  LOG_LEVEL: logLevelSchema,
});

export type WorkersConfig = z.infer<typeof workersConfigSchema>;

export function parseWorkersConfig(env: NodeJS.ProcessEnv = process.env): WorkersConfig {
  return parseEnv(workersConfigSchema, env);
}

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------

export { z, ZodError };
