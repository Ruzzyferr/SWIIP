import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { PermissionsModule } from '../permissions/permissions.module';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [PermissionsModule, SearchModule],
  providers: [MessagesService],
  controllers: [MessagesController],
  exports: [MessagesService],
})
export class MessagesModule {}
