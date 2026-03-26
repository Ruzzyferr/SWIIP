import { Module } from '@nestjs/common';
import { GuildsService } from './guilds.service';
import { GuildsController } from './guilds.controller';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  imports: [PermissionsModule],
  providers: [GuildsService],
  controllers: [GuildsController],
  exports: [GuildsService],
})
export class GuildsModule {}
