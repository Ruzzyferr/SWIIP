import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { parseApiConfig } from '@constchat/config';
import fastifyCookie from '@fastify/cookie';

// BigInt fields (e.g. permissions flags) must be serializable to JSON
(BigInt.prototype as any).toJSON = function () { return this.toString(); };

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const config = parseApiConfig(process.env);

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
    { bufferLogs: true },
  );

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      errorHttpStatusCode: 422,
    }),
  );

  await app.register(fastifyCookie as any);

  app.enableCors({
    origin: config.CORS_ORIGIN.split(','),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Swiip API')
    .setDescription('Swiip REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.PORT;
  await app.listen(port, '0.0.0.0');
  logger.log(`API running on http://0.0.0.0:${port}`);
  logger.log(`Swagger docs at http://0.0.0.0:${port}/api/docs`);
}

bootstrap();
