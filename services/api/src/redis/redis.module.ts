import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { EventPublisherService } from './event-publisher.service';

@Global()
@Module({
  providers: [RedisService, EventPublisherService],
  exports: [RedisService, EventPublisherService],
})
export class RedisModule {}
