import { Module } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { PresignController } from './presign.controller';
import { PermissionsModule } from '../permissions/permissions.module';

/**
 * Lightweight uploads module that only registers the presigned URL endpoint.
 * Does NOT depend on @nestjs/platform-express, so it works with Fastify.
 * The avatar/banner/guild-icon multipart upload endpoints remain in UploadsController
 * (disabled until platform-express is available).
 */
@Module({
  imports: [PermissionsModule],
  providers: [UploadsService],
  controllers: [PresignController],
  exports: [UploadsService],
})
export class PresignUploadsModule {}
