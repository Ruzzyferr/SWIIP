/**
 * Swiip Media Signalling Service
 *
 * Responsibilities:
 * - Voice/video room lifecycle management (via LiveKit)
 * - Screen share session tracking and quality management
 * - SFU token issuance for clients
 * - Room participant state sync (bridge to Redis/NATS)
 * - Quality profile negotiation (720p30 / 1080p30 / 1080p60 / Auto)
 *
 * Architecture:
 * - Clients call this HTTP service to get a LiveKit join token
 * - Clients connect directly to LiveKit SFU using that token
 * - This service monitors LiveKit webhooks to sync room state to Redis/NATS
 * - Gateway service picks up room events and broadcasts to subscribed clients
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { MediaModule } from './media.module';
import { parseMediaSignallingConfig } from '@constchat/config';

async function bootstrap() {
  const logger = new Logger('MediaSignalling');
  const runtimeConfig = parseMediaSignallingConfig(process.env);

  const app = await NestFactory.create<NestFastifyApplication>(
    MediaModule,
    new FastifyAdapter({ bodyLimit: 1_048_576 }),
    { rawBody: true },
  );

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  app.enableCors({
    origin: runtimeConfig.CORS_ORIGIN.split(','),
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Swiip Media Signalling')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = runtimeConfig.PORT;
  await app.listen(port, '0.0.0.0');
  logger.log(`Media Signalling running on :${port}`);
}

bootstrap();
