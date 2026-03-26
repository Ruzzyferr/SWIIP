import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ModerationService, CreateModerationActionDto } from './moderation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth.service';

@ApiTags('Moderation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('guilds/:guildId/moderation')
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post('actions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a moderation action' })
  async createAction(
    @Param('guildId') guildId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateModerationActionDto,
  ) {
    return this.moderationService.createAction(guildId, user.userId, dto);
  }

  @Get('actions')
  @ApiOperation({ summary: 'Get moderation actions' })
  async getActions(
    @Param('guildId') guildId: string,
    @Query('targetId') targetId?: string,
    @Query('actorId') actorId?: string,
    @Query('type') type?: string,
    @Query('limit') limit?: number,
  ) {
    return this.moderationService.getActions(guildId, {
      targetId,
      actorId,
      type: type as any,
      limit,
    });
  }

  @Delete('actions/:actionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a moderation action' })
  async revokeAction(
    @Param('guildId') guildId: string,
    @Param('actionId') actionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.moderationService.revokeAction(actionId, guildId, user.userId);
  }

  @Get('audit-log')
  @ApiOperation({ summary: 'Get guild audit log' })
  async getAuditLog(
    @Param('guildId') guildId: string,
    @Query('actorId') actorId?: string,
    @Query('action') action?: string,
    @Query('limit') limit?: number,
    @Query('before') before?: string,
  ) {
    return this.moderationService.getAuditLog(guildId, { actorId, action, limit, before });
  }

  @Get('automod')
  @ApiOperation({ summary: 'Get automod rules' })
  async getAutomodRules(@Param('guildId') guildId: string) {
    return this.moderationService.getAutomodRules(guildId);
  }

  @Post('automod')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an automod rule' })
  async createAutomodRule(
    @Param('guildId') guildId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: any,
  ) {
    return this.moderationService.createAutomodRule(guildId, user.userId, dto);
  }

  @Patch('automod/:ruleId')
  @ApiOperation({ summary: 'Update an automod rule' })
  async updateAutomodRule(
    @Param('guildId') guildId: string,
    @Param('ruleId') ruleId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: any,
  ) {
    return this.moderationService.updateAutomodRule(ruleId, guildId, user.userId, dto);
  }

  @Delete('automod/:ruleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an automod rule' })
  async deleteAutomodRule(
    @Param('guildId') guildId: string,
    @Param('ruleId') ruleId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.moderationService.deleteAutomodRule(ruleId, guildId, user.userId);
  }
}
