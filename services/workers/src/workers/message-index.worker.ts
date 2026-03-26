import { JetStreamClient, PubAck, StringCodec, ConsumerConfig, AckPolicy, DeliverPolicy } from 'nats';
import { PrismaClient } from '@prisma/client';
import { MeiliSearch } from 'meilisearch';
import type { Logger } from 'pino';

const sc = StringCodec();

interface MessageIndexPayload {
  action: 'create' | 'update' | 'delete';
  messageId: string;
  channelId: string;
  guildId?: string;
  content?: string;
  authorId?: string;
  authorUsername?: string;
  timestamp?: string;
}

export class MessageIndexWorker {
  private readonly meilisearch: MeiliSearch;
  private running = false;

  constructor(
    private readonly js: JetStreamClient,
    private readonly prisma: PrismaClient,
    private readonly logger: Logger,
  ) {
    this.meilisearch = new MeiliSearch({
      host: process.env.MEILISEARCH_HOST ?? 'http://localhost:7700',
      apiKey: process.env.MEILISEARCH_KEY ?? 'masterKey',
    });
  }

  async start(): Promise<void> {
    this.running = true;
    this.ensureIndex().catch((err) => this.logger.error({ err }, 'Failed to ensure search index'));
    this.consumeLoop();
    this.logger.info('MessageIndexWorker started');
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  private async ensureIndex(): Promise<void> {
    const index = this.meilisearch.index('messages');
    await this.meilisearch.createIndex('messages', { primaryKey: 'id' }).catch(() => {});
    await index.updateSettings({
      searchableAttributes: ['content', 'authorUsername'],
      filterableAttributes: ['channelId', 'guildId', 'authorId'],
      sortableAttributes: ['timestamp'],
      displayedAttributes: ['id', 'channelId', 'guildId', 'authorId', 'authorUsername', 'content', 'timestamp'],
    });
  }

  private async consumeLoop(): Promise<void> {
    // Subscribe to NATS subject for message indexing
    const subscription = await this.js.subscribe('constchat.search.messages', {
      config: {
        ack_policy: AckPolicy.Explicit,
        deliver_policy: DeliverPolicy.All,
        durable_name: 'message-indexer',
        max_deliver: 3,
      } as ConsumerConfig,
    }).catch(() => null);

    if (!subscription) {
      this.logger.warn('Could not subscribe to search.messages (NATS stream may not exist yet)');
      return;
    }

    for await (const msg of subscription) {
      if (!this.running) break;
      try {
        const payload: MessageIndexPayload = JSON.parse(sc.decode(msg.data));
        await this.processMessage(payload);
        msg.ack();
      } catch (err) {
        this.logger.error({ err }, 'Error processing message index job');
        msg.nak();
      }
    }
  }

  private async processMessage(payload: MessageIndexPayload): Promise<void> {
    const index = this.meilisearch.index('messages');

    if (payload.action === 'delete') {
      await index.deleteDocument(payload.messageId);
      return;
    }

    if (payload.action === 'create' || payload.action === 'update') {
      if (!payload.content) return;

      await index.addDocuments([{
        id: payload.messageId,
        channelId: payload.channelId,
        guildId: payload.guildId ?? null,
        authorId: payload.authorId,
        authorUsername: payload.authorUsername,
        content: payload.content,
        timestamp: payload.timestamp,
      }]);
    }
  }
}
