import { parseGatewayConfig } from '@constchat/config';
import { GatewayServer } from './server';
import { logger } from './utils/logger';

/**
 * Gateway service entry point.
 *
 * Parses and validates environment configuration, starts the WebSocket server,
 * and wires up process signal handlers for graceful shutdown.
 */
async function main(): Promise<void> {
  // Validate environment variables; throws on misconfiguration
  const config = parseGatewayConfig(process.env);

  logger.info(
    {
      port: config.PORT,
      nodeEnv: config.NODE_ENV,
      logLevel: config.LOG_LEVEL,
      maxConnections: config.MAX_CONNECTIONS,
    },
    'Starting ConstChat Gateway',
  );

  const server = new GatewayServer(config);

  // -------------------------------------------------------------------------
  // Graceful shutdown
  // -------------------------------------------------------------------------

  let isShuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info({ signal }, 'Shutdown signal received');

    try {
      await server.stop();
      logger.info('Gateway stopped cleanly');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  }

  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('SIGINT', () => { void shutdown('SIGINT'); });

  // Catch unhandled promise rejections — log and continue (avoid silent crashes)
  process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason, promise }, 'Unhandled Promise rejection');
  });

  // Catch uncaught synchronous exceptions
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception — shutting down');
    void shutdown('uncaughtException');
  });

  // -------------------------------------------------------------------------
  // Start
  // -------------------------------------------------------------------------

  try {
    await server.start();
    logger.info(
      { port: config.PORT },
      'ConstChat Gateway is ready to accept connections',
    );
  } catch (err) {
    logger.fatal({ err }, 'Failed to start gateway');
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  logger.fatal({ err }, 'Fatal error in main()');
  process.exit(1);
});
