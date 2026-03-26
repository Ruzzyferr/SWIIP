import { JetStreamClient, StringCodec, AckPolicy, DeliverPolicy, ConsumerConfig } from 'nats';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import type { Logger } from 'pino';

const sc = StringCodec();

type MediaJobType = 'avatar' | 'banner' | 'attachment_thumbnail' | 'attachment_metadata_strip';

interface MediaProcessPayload {
  jobType: MediaJobType;
  attachmentId?: string;
  userId?: string;
  s3Key: string;
  inputBuffer?: string; // base64 encoded for small files
}

export class MediaProcessWorker {
  private running = false;

  constructor(
    private readonly js: JetStreamClient,
    private readonly prisma: PrismaClient,
    private readonly logger: Logger,
  ) {}

  async start(): Promise<void> {
    this.running = true;
    this.consumeLoop();
    this.logger.info('MediaProcessWorker started');
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  private async consumeLoop(): Promise<void> {
    const subscription = await this.js.subscribe('constchat.media.process', {
      config: {
        ack_policy: AckPolicy.Explicit,
        deliver_policy: DeliverPolicy.All,
        durable_name: 'media-processor',
        max_deliver: 3,
      } as ConsumerConfig,
    }).catch(() => null);

    if (!subscription) {
      this.logger.warn('Could not subscribe to media.process');
      return;
    }

    for await (const msg of subscription) {
      if (!this.running) break;
      try {
        const payload: MediaProcessPayload = JSON.parse(sc.decode(msg.data));
        await this.processMedia(payload);
        msg.ack();
      } catch (err) {
        this.logger.error({ err }, 'Media processing error');
        msg.nak();
      }
    }
  }

  private async processMedia(payload: MediaProcessPayload): Promise<void> {
    if (!payload.inputBuffer) {
      // In production, would fetch from S3
      this.logger.debug(`Media job ${payload.jobType} for ${payload.s3Key} — no buffer provided, skipping`);
      return;
    }

    const inputBuffer = Buffer.from(payload.inputBuffer, 'base64');

    switch (payload.jobType) {
      case 'avatar':
        await this.processAvatar(inputBuffer, payload);
        break;
      case 'banner':
        await this.processBanner(inputBuffer, payload);
        break;
      case 'attachment_thumbnail':
        await this.processAttachmentThumbnail(inputBuffer, payload);
        break;
      case 'attachment_metadata_strip':
        await this.stripMetadata(inputBuffer, payload);
        break;
    }
  }

  /**
   * Avatar: resize to 512×512, convert to webp, strip EXIF
   */
  private async processAvatar(input: Buffer, payload: MediaProcessPayload): Promise<void> {
    const processed = await sharp(input)
      .resize(512, 512, { fit: 'cover', position: 'centre' })
      .webp({ quality: 85 })
      .withMetadata({ exif: {} }) // Strip EXIF
      .toBuffer();

    this.logger.debug(`Avatar processed: ${processed.length} bytes → ${payload.s3Key}`);
    // TODO: Upload processed buffer back to S3
  }

  /**
   * Banner: resize to 1920×480 with cropping, webp
   */
  private async processBanner(input: Buffer, payload: MediaProcessPayload): Promise<void> {
    const processed = await sharp(input)
      .resize(1920, 480, { fit: 'cover', position: 'top' })
      .webp({ quality: 85 })
      .withMetadata({ exif: {} })
      .toBuffer();

    this.logger.debug(`Banner processed: ${processed.length} bytes → ${payload.s3Key}`);
  }

  /**
   * Attachment thumbnail: 400×300 jpeg for preview
   */
  private async processAttachmentThumbnail(input: Buffer, payload: MediaProcessPayload): Promise<void> {
    const metadata = await sharp(input).metadata();
    if (!metadata.width || !metadata.height) return;

    const thumbnail = await sharp(input)
      .resize(400, 300, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 75, progressive: true })
      .withMetadata({ exif: {} })
      .toBuffer();

    if (payload.attachmentId) {
      await this.prisma.attachment.update({
        where: { id: payload.attachmentId },
        data: {
          width: metadata.width,
          height: metadata.height,
        },
      });
    }

    this.logger.debug(`Thumbnail generated: ${thumbnail.length} bytes`);
  }

  /**
   * Strip metadata from any image
   */
  private async stripMetadata(input: Buffer, payload: MediaProcessPayload): Promise<void> {
    const metadata = await sharp(input).metadata();
    const format = metadata.format ?? 'jpeg';

    const stripped = await sharp(input)
      .withMetadata({ exif: {}, icc: undefined, xmp: undefined } as any)
      .toFormat(format as keyof sharp.FormatEnum)
      .toBuffer();

    this.logger.debug(`Metadata stripped from ${payload.s3Key}: ${input.length} → ${stripped.length} bytes`);
  }
}
