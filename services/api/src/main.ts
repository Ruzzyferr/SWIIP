import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { parseApiConfig } from '@constchat/config';
import fastifyCookie from '@fastify/cookie';
import helmet from '@fastify/helmet';

// BigInt fields (e.g. permissions flags) must be serializable to JSON
interface BigIntJSON {
  toJSON: () => string;
}
(BigInt.prototype as unknown as BigIntJSON).toJSON = function toJSON(this: bigint) {
  return this.toString();
};

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

  // Default exports from @fastify/* vs Nest register(): instance types differ slightly; cast is sound at runtime.
  await app.register(fastifyCookie as unknown as Parameters<NestFastifyApplication['register']>[0]);
  await app.register(helmet as unknown as Parameters<NestFastifyApplication['register']>[0], {
    contentSecurityPolicy: config.NODE_ENV === 'production' ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    } : false,
  });

  app.enableCors({
    origin: config.CORS_ORIGIN.split(','),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Only expose Swagger in non-production environments
  if (config.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Swiip API')
      .setDescription('Swiip REST API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
    logger.log(`Swagger docs at http://0.0.0.0:${config.PORT}/api/docs`);
  }

  const port = config.PORT;
  await app.listen(port, '0.0.0.0');
  logger.log(`API running on http://0.0.0.0:${port}`);
}

bootstrap();
