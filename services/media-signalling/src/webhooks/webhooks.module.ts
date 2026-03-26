import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { RoomsModule } from '../rooms/rooms.module';

@Module({
  imports: [RoomsModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
