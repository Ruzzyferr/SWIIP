import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import {
  MessagesService,
  CreateMessageDto,
  UpdateMessageDto,
  GetMessagesDto,
} from './messages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth.service';

@ApiTags('Messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('channels/:channelId/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a message' })
  async create(
    @Param('channelId') channelId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateMessageDto,
  ) {
    return this.messagesService.create(channelId, user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get messages in a channel' })
  async getMessages(
    @Param('channelId') channelId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: GetMessagesDto,
  ) {
    return this.messagesService.getMessages(channelId, user.userId, query);
  }

  @Get(':messageId')
  @ApiOperation({ summary: 'Get a specific message' })
  async getMessage(
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.messagesService.getMessage(messageId, channelId, user.userId);
  }

  @Patch(':messageId')
  @ApiOperation({ summary: 'Edit a message' })
  async update(
    @Param('messageId') messageId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateMessageDto,
  ) {
    return this.messagesService.update(messageId, user.userId, dto);
  }

  @Delete(':messageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a message' })
  async delete(
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.messagesService.delete(messageId, user.userId);
  }

  @Post('bulk-delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Bulk delete messages (mod action)' })
  async bulkDelete(
    @Param('channelId') channelId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { messages: string[] },
  ) {
    await this.messagesService.bulkDelete(channelId, user.userId, body.messages);
  }

  @Put(':messageId/reactions/:emoji/@me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Add a reaction to a message' })
  async addReaction(
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string,
    @Param('emoji') emoji: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.messagesService.addReaction(messageId, channelId, user.userId, decodeURIComponent(emoji));
  }

  @Delete(':messageId/reactions/:emoji/@me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove your reaction from a message' })
  async removeMyReaction(
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string,
    @Param('emoji') emoji: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.messagesService.removeReaction(messageId, channelId, user.userId, decodeURIComponent(emoji));
  }

  @Delete(':messageId/reactions/:emoji/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove another user's reaction (mod action)" })
  async removeUserReaction(
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string,
    @Param('emoji') emoji: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() _user: AuthUser,
  ) {
    await this.messagesService.removeReaction(messageId, channelId, targetUserId, decodeURIComponent(emoji));
  }

  @Get(':messageId/reactions/:emoji')
  @ApiOperation({ summary: 'Get users who reacted with an emoji' })
  async getReactions(
    @Param('messageId') messageId: string,
    @Param('emoji') emoji: string,
  ) {
    return this.messagesService.getReactions(messageId, decodeURIComponent(emoji));
  }

  @Delete(':messageId/reactions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove all reactions from a message (mod action)' })
  async removeAllReactions(
    @Param('messageId') messageId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.messagesService.removeAllReactions(messageId, user.userId);
  }

  @Post(':messageId/crosspost')
  @ApiOperation({ summary: 'Crosspost an announcement message' })
  async crosspost(
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.messagesService.crosspost(messageId, channelId, user.userId);
  }

  @Get(':messageId/revisions')
  @ApiOperation({ summary: 'Get edit history for a message' })
  async getRevisions(
    @Param('messageId') messageId: string,
  ) {
    return this.messagesService.getRevisions(messageId);
  }
}
