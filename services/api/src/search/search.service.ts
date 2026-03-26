import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MeiliSearch, SearchResponse } from 'meilisearch';
import { ConfigService } from '@nestjs/config';

export interface MessageSearchResult {
  id: string;
  channelId: string;
  guildId?: string;
  authorId: string;
  authorUsername: string;
  content: string;
  timestamp: string;
}

export interface SearchFilters {
  channelId?: string;
  authorId?: string;
  before?: string; // ISO date
  after?: string;  // ISO date
  has?: ('link' | 'embed' | 'file' | 'image')[];
}

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private readonly client: MeiliSearch;

  constructor(private readonly config: ConfigService) {
    this.client = new MeiliSearch({
      host: this.config.get('MEILISEARCH_HOST', 'http://localhost:7700'),
      apiKey: this.config.get('MEILISEARCH_KEY', 'masterKey'),
    });
  }

  async onModuleInit() {
    await this.ensureIndexes().catch((err) =>
      this.logger.warn({ err }, 'Could not initialize search indexes (Meilisearch may not be running)'),
    );
  }

  private async ensureIndexes(): Promise<void> {
    // Messages index
    await this.client.createIndex('messages', { primaryKey: 'id' }).catch(() => {});
    await this.client.index('messages').updateSettings({
      searchableAttributes: ['content', 'authorUsername'],
      filterableAttributes: ['channelId', 'guildId', 'authorId', 'timestamp'],
      sortableAttributes: ['timestamp'],
      rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
    });

    // Users index
    await this.client.createIndex('users', { primaryKey: 'id' }).catch(() => {});
    await this.client.index('users').updateSettings({
      searchableAttributes: ['username', 'globalName'],
      filterableAttributes: ['guildId'],
    });

    this.logger.log('Search indexes initialized');
  }

  async searchMessages(
    guildId: string,
    query: string,
    filters: SearchFilters = {},
    limit = 25,
    offset = 0,
  ): Promise<{ results: MessageSearchResult[]; total: number }> {
    const filterParts: string[] = [`guildId = "${guildId}"`];

    if (filters.channelId) filterParts.push(`channelId = "${filters.channelId}"`);
    if (filters.authorId) filterParts.push(`authorId = "${filters.authorId}"`);
    if (filters.after) filterParts.push(`timestamp > "${filters.after}"`);
    if (filters.before) filterParts.push(`timestamp < "${filters.before}"`);

    try {
      const result = await this.client
        .index('messages')
        .search<MessageSearchResult>(query, {
          filter: filterParts.join(' AND '),
          limit,
          offset,
          sort: ['timestamp:desc'],
        });

      return {
        results: result.hits,
        total: result.estimatedTotalHits ?? result.hits.length,
      };
    } catch (err) {
      this.logger.error({ err }, 'Message search failed');
      return { results: [], total: 0 };
    }
  }

  async indexMessage(message: {
    id: string;
    channelId: string;
    guildId?: string;
    authorId: string;
    authorUsername: string;
    content: string;
    timestamp: Date;
  }): Promise<void> {
    await this.client.index('messages').addDocuments([{
      ...message,
      timestamp: message.timestamp.toISOString(),
    }]);
  }

  async updateMessageIndex(messageId: string, content: string): Promise<void> {
    await this.client.index('messages').updateDocuments([{ id: messageId, content }]);
  }

  async deleteMessageFromIndex(messageId: string): Promise<void> {
    await this.client.index('messages').deleteDocument(messageId).catch(() => {});
  }

  async searchUsers(guildId: string, query: string, limit = 10): Promise<any[]> {
    try {
      const result = await this.client.index('users').search(query, {
        filter: `guildId = "${guildId}"`,
        limit,
      });
      return result.hits;
    } catch {
      return [];
    }
  }
}
