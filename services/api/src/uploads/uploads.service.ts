import {
  Injectable,
  BadRequestException,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { nanoid } from 'nanoid';
import * as https from 'https';
import * as http from 'http';
import * as url from 'url';

export interface ProcessImageOptions {
  width: number;
  height: number;
  fit?: keyof sharp.FitEnum;
  format?: 'webp' | 'jpeg' | 'png';
  quality?: number;
}

export interface UploadResult {
  s3Key: string;
  cdnUrl: string;
  filename: string;
  contentType: string;
  size: number;
  width?: number;
  height?: number;
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_ATTACHMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'application/pdf',
  'text/plain',
  'application/zip',
  'application/json',
];

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly maxUploadSizeMB: number;
  private readonly s3Endpoint: string;
  private readonly s3Bucket: string;
  private readonly s3AccessKey: string;
  private readonly s3SecretKey: string;
  private readonly s3Region: string;
  private readonly cdnUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.maxUploadSizeMB = parseInt(
      this.configService.get<string>('MAX_UPLOAD_SIZE_MB', '25'),
      10,
    );
    this.s3Endpoint = this.configService.get<string>('S3_ENDPOINT', 'http://localhost:9000');
    this.s3Bucket = this.configService.get<string>('S3_BUCKET', 'constchat');
    this.s3AccessKey = this.configService.get<string>('S3_ACCESS_KEY', 'minioadmin');
    this.s3SecretKey = this.configService.get<string>('S3_SECRET_KEY', 'minioadmin');
    this.s3Region = this.configService.get<string>('S3_REGION', 'us-east-1');
    this.cdnUrl = this.configService.get<string>('S3_CDN_URL', 'http://localhost:9000/constchat');
  }

  async uploadAvatar(userId: string, file: Express.Multer.File): Promise<UploadResult> {
    this.validateImageFile(file, 8);

    const processed = await this.processImage(file.buffer, {
      width: 512,
      height: 512,
      fit: 'cover',
      format: 'webp',
      quality: 90,
    });

    const s3Key = `avatars/${userId}/${nanoid(16)}.webp`;
    await this.uploadToS3(s3Key, processed, 'image/webp');

    return {
      s3Key,
      cdnUrl: this.generateCdnUrl(s3Key),
      filename: `${userId}-avatar.webp`,
      contentType: 'image/webp',
      size: processed.length,
      width: 512,
      height: 512,
    };
  }

  async uploadBanner(userId: string, file: Express.Multer.File): Promise<UploadResult> {
    this.validateImageFile(file, 8);

    const processed = await this.processImage(file.buffer, {
      width: 1920,
      height: 480,
      fit: 'cover',
      format: 'webp',
      quality: 85,
    });

    const s3Key = `banners/${userId}/${nanoid(16)}.webp`;
    await this.uploadToS3(s3Key, processed, 'image/webp');

    return {
      s3Key,
      cdnUrl: this.generateCdnUrl(s3Key),
      filename: `${userId}-banner.webp`,
      contentType: 'image/webp',
      size: processed.length,
      width: 1920,
      height: 480,
    };
  }

  async uploadGuildIcon(guildId: string, file: Express.Multer.File): Promise<UploadResult> {
    this.validateImageFile(file, 8);

    const processed = await this.processImage(file.buffer, {
      width: 512,
      height: 512,
      fit: 'cover',
      format: 'webp',
      quality: 90,
    });

    const s3Key = `guilds/${guildId}/icons/${nanoid(16)}.webp`;
    await this.uploadToS3(s3Key, processed, 'image/webp');

    return {
      s3Key,
      cdnUrl: this.generateCdnUrl(s3Key),
      filename: `${guildId}-icon.webp`,
      contentType: 'image/webp',
      size: processed.length,
      width: 512,
      height: 512,
    };
  }

  async uploadAttachment(
    channelId: string,
    userId: string,
    file: Express.Multer.File,
  ): Promise<{
    s3Key: string;
    cdnUrl: string;
    filename: string;
    originalFilename: string;
    contentType: string;
    size: bigint;
    width?: number;
    height?: number;
    spoiler: boolean;
  }> {
    const maxBytes = this.maxUploadSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new PayloadTooLargeException(`File too large. Maximum ${this.maxUploadSizeMB}MB`);
    }

    if (!ALLOWED_ATTACHMENT_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`File type ${file.mimetype} is not allowed`);
    }

    const spoiler = file.originalname.startsWith('SPOILER_');
    const safeFilename = this.sanitizeFilename(file.originalname);
    const s3Key = `attachments/${channelId}/${userId}/${nanoid(16)}/${safeFilename}`;

    let width: number | undefined;
    let height: number | undefined;

    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      try {
        const metadata = await sharp(file.buffer).metadata();
        width = metadata.width;
        height = metadata.height;
      } catch {
        // Not an image we can get dimensions from
      }
    }

    await this.uploadToS3(s3Key, file.buffer, file.mimetype);

    return {
      s3Key,
      cdnUrl: this.generateCdnUrl(s3Key),
      filename: safeFilename,
      originalFilename: file.originalname,
      contentType: file.mimetype,
      size: BigInt(file.size),
      width,
      height,
      spoiler,
    };
  }

  async processImage(buffer: Buffer, options: ProcessImageOptions): Promise<Buffer> {
    const format = options.format ?? 'webp';
    const quality = options.quality ?? 85;

    let pipeline = sharp(buffer)
      .resize(options.width, options.height, {
        fit: options.fit ?? 'cover',
        withoutEnlargement: false,
      });

    if (format === 'webp') {
      pipeline = pipeline.webp({ quality });
    } else if (format === 'jpeg') {
      pipeline = pipeline.jpeg({ quality });
    } else if (format === 'png') {
      pipeline = pipeline.png({ quality });
    }

    return pipeline.toBuffer();
  }

  generateAvatarUrl(avatarId: string, userId?: string): string {
    if (!avatarId) return this.generateDefaultAvatarUrl();
    return `${this.cdnUrl}/avatars/${userId ?? ''}/${avatarId}.webp`;
  }

  generateDefaultAvatarUrl(): string {
    return `${this.cdnUrl}/embed/avatars/default.png`;
  }

  generateCdnUrl(s3Key: string): string {
    return `${this.cdnUrl}/${s3Key}`;
  }

  async getSignedUrl(s3Key: string, expiresInSeconds = 3600): Promise<string> {
    // For MinIO/S3, we generate a pre-signed URL
    // In production, use @aws-sdk/client-s3 with GetObjectCommand + getSignedUrl
    // This is a placeholder that returns the direct URL
    this.logger.debug(`Generating signed URL for: ${s3Key}`);
    return `${this.s3Endpoint}/${this.s3Bucket}/${s3Key}?X-Expires=${Date.now() + expiresInSeconds * 1000}`;
  }

  async deleteObject(s3Key: string): Promise<void> {
    this.logger.log(`Deleting S3 object: ${s3Key}`);
    // In production: use @aws-sdk/client-s3 with DeleteObjectCommand
    // For now, make HTTP DELETE request to MinIO
    try {
      await this.s3Request('DELETE', s3Key, null);
    } catch (err) {
      this.logger.error(`Failed to delete S3 object ${s3Key}:`, err);
      throw err;
    }
  }

  private async uploadToS3(s3Key: string, data: Buffer, contentType: string): Promise<void> {
    this.logger.debug(`Uploading to S3: ${s3Key} (${data.length} bytes, ${contentType})`);
    await this.s3Request('PUT', s3Key, data, { 'Content-Type': contentType });
  }

  private async s3Request(
    method: string,
    s3Key: string,
    body: Buffer | null,
    headers: Record<string, string> = {},
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const endpoint = new URL(`${this.s3Endpoint}/${this.s3Bucket}/${s3Key}`);
      const isHttps = endpoint.protocol === 'https:';
      const requestModule = isHttps ? https : http;

      const options: http.RequestOptions = {
        method,
        hostname: endpoint.hostname,
        port: endpoint.port ? parseInt(endpoint.port, 10) : (isHttps ? 443 : 80),
        path: endpoint.pathname,
        headers: {
          ...headers,
          ...(body ? { 'Content-Length': body.length.toString() } : {}),
        },
      };

      const req = requestModule.request(options, (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`S3 request failed with status ${res.statusCode}`));
        }
      });

      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }

  private validateImageFile(file: Express.Multer.File, maxSizeMB: number): void {
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new PayloadTooLargeException(`Image too large. Maximum ${maxSizeMB}MB`);
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`Invalid image type: ${file.mimetype}`);
    }
  }

  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, 255);
  }
}
