import { Module } from '@nestjs/common';
import { DMsService } from './dms.service';
import { DMsController } from './dms.controller';

@Module({
  providers: [DMsService],
  controllers: [DMsController],
  exports: [DMsService],
})
export class DMsModule {}
