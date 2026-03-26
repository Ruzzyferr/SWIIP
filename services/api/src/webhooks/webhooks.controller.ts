import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import {
  WebhooksService,
  CreateWebhookDto,
  UpdateWebhookDto,
  ExecuteWebhookDto,
} from './webhooks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { AuthUser } from '../auth/auth.service';

@ApiTags('Webhooks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('channels/:channelId/webhooks')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a webhook for a channel' })
  async create(
    @Param('channelId') channelId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateWebhookDto,
    @Body('guildId') guildId: string,
  ) {
    return this.webhooksService.create(channelId, guildId, user.userId, dto);
  }

  @Get('guilds/:guildId/webhooks')
  @ApiOperation({ summary: 'Get all webhooks in a guild' })
  async getGuildWebhooks(
    @Param('guildId') guildId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.webhooksService.getGuildWebhooks(guildId, user.userId);
  }

  @Get('channels/:channelId/webhooks')
  @ApiOperation({ summary: 'Get webhooks for a channel' })
  async getChannelWebhooks(
    @Param('channelId') channelId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.webhooksService.getChannelWebhooks(channelId, user.userId);
  }

  @Get('webhooks/:webhookId')
  @ApiOperation({ summary: 'Get a webhook by ID' })
  async getWebhook(
    @Param('webhookId') webhookId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.webhooksService.getWebhook(webhookId, user.userId);
  }

  @Patch('webhooks/:webhookId')
  @ApiOperation({ summary: 'Update a webhook' })
  async update(
    @Param('webhookId') webhookId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.webhooksService.update(webhookId, user.userId, dto);
  }

  @Delete('webhooks/:webhookId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a webhook' })
  async delete(
    @Param('webhookId') webhookId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.webhooksService.delete(webhookId, user.userId);
  }

  @Public()
  @Post('webhooks/:webhookId/:token')
  @ApiOperation({ summary: 'Execute a webhook' })
  async execute(
    @Param('webhookId') webhookId: string,
    @Param('token') token: string,
    @Body() dto: ExecuteWebhookDto,
  ) {
    return this.webhooksService.execute(webhookId, token, dto);
  }
}
