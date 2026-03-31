import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController, ChannelSearchController } from './search.controller';

@Module({
  providers: [SearchService],
  controllers: [SearchController, ChannelSearchController],
  exports: [SearchService],
})
export class SearchModule {}
