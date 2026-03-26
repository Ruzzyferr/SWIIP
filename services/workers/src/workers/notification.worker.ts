import { JetStreamClient, StringCodec, AckPolicy, DeliverPolicy, ConsumerConfig } from 'nats';
import { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';

const sc = StringCodec();

interface NotificationPayload {
  type: 'mention' | 'reply' | 'dm' | 'friend_request' | 'system';
  recipientId: string;
  actorId?: string;
  title: string;
  body: string;
  iconUrl?: string;
  targetUrl?: string;
  guildId?: string;
  channelId?: string;
  messageId?: string;
}

export class NotificationWorker {
  private running = false;

  constructor(
    private readonly js: JetStreamClient,
    private readonly prisma: PrismaClient,
    private readonly logger: Logger,
  ) {}

  async start(): Promise<void> {
    this.running = true;
    this.consumeLoop();
    this.logger.info('NotificationWorker started');
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  private async consumeLoop(): Promise<void> {
    const subscription = await this.js.subscribe('constchat.notifications.dispatch', {
      config: {
        ack_policy: AckPolicy.Explicit,
        deliver_policy: DeliverPolicy.All,
        durable_name: 'notification-dispatcher',
        max_deliver: 3,
      } as ConsumerConfig,
    }).catch(() => null);

    if (!subscription) {
      this.logger.warn('Could not subscribe to notifications.dispatch');
      return;
    }

    for await (const msg of subscription) {
      if (!this.running) break;
      try {
        const payload: NotificationPayload = JSON.parse(sc.decode(msg.data));
        await this.processNotification(payload);
        msg.ack();
      } catch (err) {
        this.logger.error({ err }, 'Notification dispatch error');
        msg.nak();
      }
    }
  }

  private async processNotification(payload: NotificationPayload): Promise<void> {
    // 1. Check user notification preferences
    const prefs = await this.prisma.readState.findFirst({
      where: {
        userId: payload.recipientId,
        channelId: payload.channelId ?? '',
      },
    });

    // If channel is muted, skip
    if (prefs?.muted) {
      if (!prefs.muteUntil || prefs.muteUntil > new Date()) {
        return;
      }
    }

    // 2. Create in-app notification record
    await this.prisma.notification.create({
      data: {
        userId: payload.recipientId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        iconUrl: payload.iconUrl,
        targetUrl: payload.targetUrl,
      },
    });

    // 3. TODO: Web push notification (via web-push library)
    // TODO: Email notification (via Resend/SendGrid) for offline users

    this.logger.debug(`Notification created for user ${payload.recipientId}: ${payload.type}`);
  }
}
