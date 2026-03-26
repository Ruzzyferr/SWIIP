import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import {
  ChannelsService,
  CreateChannelDto,
  UpdateChannelDto,
  CreateChannelInviteDto,
} from './channels.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth.service';

@ApiTags('Channels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Post('guilds/:guildId/channels')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a channel in a guild' })
  async create(
    @Param('guildId') guildId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateChannelDto,
  ) {
    return this.channelsService.create(guildId, user.userId, dto);
  }

  @Get('guilds/:guildId/channels')
  @ApiOperation({ summary: 'Get all channels in a guild' })
  async getGuildChannels(
    @Param('guildId') guildId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.channelsService.getGuildChannels(guildId, user.userId);
  }

  @Get('channels/:id')
  @ApiOperation({ summary: 'Get a channel by ID' })
  async getChannel(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.channelsService.getChannel(id, user.userId);
  }

  @Patch('channels/:id')
  @ApiOperation({ summary: 'Update a channel' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateChannelDto,
  ) {
    return this.channelsService.update(id, user.userId, dto);
  }

  @Delete('channels/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a channel' })
  async delete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.channelsService.delete(id, user.userId);
  }

  @Put('channels/:id/permissions/:overwriteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Update channel permission overwrite' })
  async updatePermissionOverwrite(
    @Param('id') channelId: string,
    @Param('overwriteId') targetId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { type: 'ROLE' | 'MEMBER'; allow: string; deny: string },
  ) {
    await this.channelsService.updatePermissionOverwrite(
      channelId,
      user.userId,
      targetId,
      body.type,
      BigInt(body.allow),
      BigInt(body.deny),
    );
  }

  @Delete('channels/:id/permissions/:overwriteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete channel permission overwrite' })
  async deletePermissionOverwrite(
    @Param('id') channelId: string,
    @Param('overwriteId') targetId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.channelsService.deletePermissionOverwrite(channelId, user.userId, targetId);
  }

  @Get('channels/:id/invites')
  @ApiOperation({ summary: 'Get channel invites' })
  async getInvites(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.channelsService.getChannelInvites(id, user.userId);
  }

  @Post('channels/:id/invites')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create invite for channel' })
  async createInvite(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateChannelInviteDto,
  ) {
    return this.channelsService.createInvite(id, user.userId, dto);
  }

  @Post('channels/:id/typing')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Trigger typing indicator' })
  async triggerTyping(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.channelsService.triggerTyping(id, user.userId);
  }

  @Get('channels/:id/pins')
  @ApiOperation({ summary: 'Get pinned messages' })
  async getPins(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.channelsService.getPins(id, user.userId);
  }

  @Put('channels/:id/pins/:messageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Pin a message' })
  async pinMessage(
    @Param('id') channelId: string,
    @Param('messageId') messageId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.channelsService.pinMessage(channelId, messageId, user.userId);
  }

  @Delete('channels/:id/pins/:messageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unpin a message' })
  async unpinMessage(
    @Param('id') channelId: string,
    @Param('messageId') messageId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.channelsService.unpinMessage(channelId, messageId, user.userId);
  }
}
