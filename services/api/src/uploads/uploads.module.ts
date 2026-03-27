import { Module } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { UploadsController } from './uploads.controller';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  imports: [PermissionsModule],
  providers: [UploadsService],
  controllers: [UploadsController],
  exports: [UploadsService],
})
export class UploadsModule {}
