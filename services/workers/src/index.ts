/**
 * ConstChat Workers Service
 *
 * Background job processor consuming from NATS JetStream.
 * Each worker subscribes to specific subjects and processes jobs:
 *
 * - notifications.dispatch   → Send push/email notifications
 * - search.index.message     → Index/update message in Meilisearch
 * - search.delete.message    → Remove message from search index
 * - media.process.attachment → Generate thumbnails, strip metadata
 * - media.process.avatar     → Resize/compress avatar images
 * - automod.check.message    → Run automod rules against message
 * - audit.log                → Write immutable audit log entry
 *
 * Architecture: Pull-based NATS consumer with durable subscription.
 * On crash/restart, NATS replays unacknowledged messages.
 * Max-in-flight limited to prevent memory pressure.
 */

import { connect, NatsConnection, JetStreamClient, StringCodec } from 'nats';
import { PrismaClient } from '@prisma/client';
import pino from 'pino';
import { MessageIndexWorker } from './workers/message-index.worker';
import { NotificationWorker } from './workers/notification.worker';
import { MediaProcessWorker } from './workers/media-process.worker';
import { AutomodWorker } from './workers/automod.worker';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  ...(process.env.NODE_ENV !== 'production' ? { transport: { target: 'pino-pretty' } } : {}),
});

const prisma = new PrismaClient();
const sc = StringCodec();

async function main() {
  logger.info('ConstChat Workers starting...');

  // Connect to NATS
  const nc: NatsConnection = await connect({
    servers: process.env.NATS_URL ?? 'nats://localhost:4222',
    reconnect: true,
    maxReconnectAttempts: -1,
    reconnectTimeWait: 2000,
  });
  logger.info('Connected to NATS');

  const js: JetStreamClient = nc.jetstream();

  // Initialize workers
  const workers = [
    new MessageIndexWorker(js, prisma, logger),
    new NotificationWorker(js, prisma, logger),
    new MediaProcessWorker(js, prisma, logger),
    new AutomodWorker(js, prisma, logger),
  ];

  for (const worker of workers) {
    await worker.start();
  }

  logger.info(`${workers.length} workers active`);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down workers...`);
    for (const worker of workers) {
      await worker.stop();
    }
    await nc.drain();
    await prisma.$disconnect();
    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Keep alive
  await nc.closed();
}

main().catch((err) => {
  logger.error({ err }, 'Worker startup failed');
  process.exit(1);
});
