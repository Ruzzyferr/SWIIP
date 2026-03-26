import pino from 'pino';

const isDev = process.env['NODE_ENV'] !== 'production';

export const logger = pino({
  name: 'constchat-gateway',
  level: process.env['LOG_LEVEL'] ?? 'info',
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
  base: {
    service: 'gateway',
    version: process.env['npm_package_version'] ?? '0.1.0',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['token', 'authorization', 'd.token', '*.token', '*.password'],
    censor: '[REDACTED]',
  },
});

/**
 * Creates a child logger bound to a specific session / request context.
 */
export function createSessionLogger(sessionId: string, userId?: string) {
  return logger.child({ sessionId, userId });
}

/**
 * Creates a child logger bound to a specific component.
 */
export function createComponentLogger(component: string) {
  return logger.child({ component });
}

export type Logger = typeof logger;
