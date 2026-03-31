import { JetStreamClient, StringCodec, AckPolicy, DeliverPolicy, ConsumerConfig } from 'nats';
import { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';

const sc = StringCodec();

interface AutomodPayload {
  messageId: string;
  channelId: string;
  guildId: string;
  authorId: string;
  content: string;
  timestamp: string;
}

interface AutomodRule {
  id: string;
  triggerType: string;
  triggerMetadata: any;
  actions: any;
  exemptRoles: string[];
  exemptChannels: string[];
}

type AutomodAction =
  | { type: 'BLOCK_MESSAGE' }
  | { type: 'SEND_ALERT'; channelId: string; message: string }
  | { type: 'TIMEOUT'; durationSeconds: number }
  | { type: 'SEND_AUTOMOD_MESSAGE' };

export class AutomodWorker {
  private running = false;

  constructor(
    private readonly js: JetStreamClient,
    private readonly prisma: PrismaClient,
    private readonly logger: Logger,
  ) {}

  async start(): Promise<void> {
    this.running = true;
    this.consumeLoop();
    this.logger.info('AutomodWorker started');
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  private async consumeLoop(): Promise<void> {
    const subscription = await this.js.subscribe('constchat.automod.check', {
      config: {
        ack_policy: AckPolicy.Explicit,
        deliver_policy: DeliverPolicy.All,
        durable_name: 'automod-checker',
        max_deliver: 1, // Don't retry automod checks
      } as ConsumerConfig,
    }).catch(() => null);

    if (!subscription) {
      this.logger.warn('Could not subscribe to automod.check');
      return;
    }

    for await (const msg of subscription) {
      if (!this.running) break;
      try {
        const payload: AutomodPayload = JSON.parse(sc.decode(msg.data));
        await this.checkMessage(payload);
        msg.ack();
      } catch (err) {
        this.logger.error({ err }, 'Automod check error');
        msg.ack(); // Still ack to prevent loop
      }
    }
  }

  private async checkMessage(payload: AutomodPayload): Promise<void> {
    // Load active automod rules for this guild
    const rules = await this.prisma.automodRule.findMany({
      where: {
        guildId: payload.guildId,
        enabled: true,
        NOT: {
          exemptChannels: { has: payload.channelId },
        },
      },
    });

    for (const rule of rules) {
      const triggered = this.evaluateRule(rule, payload);
      if (triggered) {
        await this.executeActions(rule, payload);
      }
    }
  }

  private evaluateRule(rule: AutomodRule, payload: AutomodPayload): boolean {
    const meta = rule.triggerMetadata;

    switch (rule.triggerType) {
      case 'KEYWORD': {
        const keywords: string[] = meta.keywordFilter ?? [];
        const content = payload.content.toLowerCase();
        return keywords.some((kw) => content.includes(kw.toLowerCase()));
      }

      case 'MENTION_SPAM': {
        const maxMentions: number = meta.mentionTotalLimit ?? 10;
        const mentionCount = (payload.content.match(/<@[!&]?\d+>/g) ?? []).length;
        return mentionCount >= maxMentions;
      }

      case 'SPAM': {
        // Would need Redis to track recent messages from this user
        // For now: detect repeated content (>3x same characters)
        return /(.)\1{9,}/.test(payload.content);
      }

      case 'HARMFUL_LINK': {
        const blocklist: string[] = meta.allowList ? [] : (meta.domainBlocklist ?? []);
        return blocklist.some((domain) => payload.content.includes(domain));
      }

      default:
        return false;
    }
  }

  private async executeActions(rule: AutomodRule, payload: AutomodPayload): Promise<void> {
    const actions: AutomodAction[] = rule.actions ?? [];

    for (const action of actions) {
      try {
        switch (action.type) {
          case 'BLOCK_MESSAGE':
            // Mark message as blocked (soft delete)
            await this.prisma.message.update({
              where: { id: payload.messageId },
              data: { deletedAt: new Date(), flags: { increment: 1 } },
            });
            this.logger.info(`Automod blocked message ${payload.messageId} in guild ${payload.guildId}`);
            break;

          case 'TIMEOUT':
            // Apply timeout to author
            await this.prisma.guildMember.updateMany({
              where: { guildId: payload.guildId, userId: payload.authorId },
              data: {
                timeoutUntil: new Date(Date.now() + action.durationSeconds * 1000),
              },
            });
            this.logger.info(`Automod timed out user ${payload.authorId} for ${action.durationSeconds}s`);
            break;

          case 'SEND_ALERT':
            // Would publish to NATS to send a system message in the alert channel
            this.logger.info(`Automod alert for message ${payload.messageId}`);
            break;
        }
      } catch (err) {
        this.logger.error({ err, action }, 'Failed to execute automod action');
      }
    }
  }
}
