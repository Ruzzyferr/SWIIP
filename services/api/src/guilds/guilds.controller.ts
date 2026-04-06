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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import {
  GuildsService,
  CreateGuildDto,
  UpdateGuildDto,
  UpdateMemberDto,
} from './guilds.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GuildPermissionGuard } from '../auth/guards/guild-permission.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth.service';
import { Permissions } from '../permissions/permissions.service';

@ApiTags('Guilds')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('guilds')
export class GuildsController {
  constructor(private readonly guildsService: GuildsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new guild' })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateGuildDto) {
    return this.guildsService.create(user.userId, dto);
  }

  @Get('discover')
  @ApiOperation({ summary: 'Browse discoverable guilds' })
  async discover(
    @CurrentUser() user: AuthUser,
    @Query('search') search?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.guildsService.discoverGuilds(user.userId, { search, limit: limit ?? 20, offset: offset ?? 0 });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get guild by ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.guildsService.findById(id, user.userId);
  }

  @Patch(':id')
  @UseGuards(GuildPermissionGuard)
  @RequirePermissions(Permissions.MANAGE_GUILD)
  @ApiOperation({ summary: 'Update guild settings' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateGuildDto,
  ) {
    return this.guildsService.update(id, user.userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(GuildPermissionGuard)
  @RequirePermissions(Permissions.MANAGE_GUILD)
  @ApiOperation({ summary: 'Delete guild (owner only)' })
  async delete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.guildsService.delete(id, user.userId);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'Get guild members' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'after', required: false, type: String })
  async getMembers(
    @Param('id') id: string,
    @Query('limit') limit?: number,
    @Query('after') after?: string,
  ) {
    return this.guildsService.getMembers(id, { limit, after });
  }

  @Get(':id/members/:userId')
  @ApiOperation({ summary: 'Get specific guild member' })
  async getMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.guildsService.getMember(id, userId);
  }

  @Patch(':id/members/:userId')
  @UseGuards(GuildPermissionGuard)
  @RequirePermissions(Permissions.MANAGE_ROLES)
  @ApiOperation({ summary: 'Update guild member' })
  async updateMember(
    @Param('id') guildId: string,
    @Param('userId') targetId: string,
    @CurrentUser() actor: AuthUser,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.guildsService.updateMember(guildId, actor.userId, targetId, dto);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(GuildPermissionGuard)
  @RequirePermissions(Permissions.KICK_MEMBERS)
  @ApiOperation({ summary: 'Kick guild member' })
  async removeMember(
    @Param('id') guildId: string,
    @Param('userId') targetId: string,
    @CurrentUser() actor: AuthUser,
    @Query('reason') reason?: string,
  ) {
    await this.guildsService.removeMember(guildId, actor.userId, targetId, reason);
  }

  @Get(':id/bans')
  @UseGuards(GuildPermissionGuard)
  @RequirePermissions(Permissions.BAN_MEMBERS)
  @ApiOperation({ summary: 'Get guild bans' })
  async getBans(@Param('id') id: string) {
    return this.guildsService.getBans(id);
  }

  @Put(':id/bans/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(GuildPermissionGuard)
  @RequirePermissions(Permissions.BAN_MEMBERS)
  @ApiOperation({ summary: 'Ban a user from the guild' })
  async banMember(
    @Param('id') guildId: string,
    @Param('userId') targetId: string,
    @CurrentUser() actor: AuthUser,
    @Body() body: { reason?: string; deleteMessageDays?: number },
  ) {
    await this.guildsService.banMember(
      guildId,
      actor.userId,
      targetId,
      body.reason,
      body.deleteMessageDays,
    );
  }

  @Delete(':id/bans/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(GuildPermissionGuard)
  @RequirePermissions(Permissions.BAN_MEMBERS)
  @ApiOperation({ summary: 'Unban a user' })
  async unbanMember(
    @Param('id') guildId: string,
    @Param('userId') targetId: string,
    @CurrentUser() actor: AuthUser,
  ) {
    await this.guildsService.unbanMember(guildId, actor.userId, targetId);
  }

  // GET :id/invites is handled by InvitesController

  @Post(':id/join')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Join a discoverable guild' })
  async joinDiscoverable(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.guildsService.joinDiscoverable(id, user.userId);
  }

  @Post(':id/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Leave a guild' })
  async leave(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.guildsService.leave(id, user.userId);
  }

  @Post(':id/transfer')
  @ApiOperation({ summary: 'Transfer guild ownership' })
  async transferOwnership(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { newOwnerId: string },
  ) {
    return this.guildsService.transferOwnership(id, user.userId, body.newOwnerId);
  }

  @Get(':id/welcome-screen')
  @ApiOperation({ summary: 'Get guild welcome screen' })
  async getWelcomeScreen(@Param('id') id: string) {
    return this.guildsService.getWelcomeScreen(id);
  }

  @Patch(':id/welcome-screen')
  @UseGuards(GuildPermissionGuard)
  @RequirePermissions(Permissions.MANAGE_GUILD)
  @ApiOperation({ summary: 'Update guild welcome screen' })
  async updateWelcomeScreen(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { enabled: boolean; description?: string; channels?: { channelId: string; description: string; emoji?: string }[] },
  ) {
    return this.guildsService.updateWelcomeScreen(id, user.userId, body);
  }

  @Get(':id/events')
  @ApiOperation({ summary: 'List scheduled events for a guild' })
  async getEvents(@Param('id') guildId: string) {
    return this.guildsService.getEvents(guildId);
  }

  @Post(':id/events')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a scheduled event' })
  async createEvent(
    @Param('id') guildId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { name: string; description?: string; startTime: string; endTime?: string; location?: string; channelId?: string },
  ) {
    return this.guildsService.createEvent(guildId, user.userId, body);
  }

  @Patch(':id/events/:eventId')
  @ApiOperation({ summary: 'Update a scheduled event' })
  async updateEvent(
    @Param('id') guildId: string,
    @Param('eventId') eventId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { name?: string; description?: string; startTime?: string; endTime?: string; location?: string; status?: string },
  ) {
    return this.guildsService.updateEvent(eventId, guildId, user.userId, body);
  }

  @Delete(':id/events/:eventId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a scheduled event' })
  async deleteEvent(
    @Param('id') guildId: string,
    @Param('eventId') eventId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.guildsService.deleteEvent(eventId, guildId, user.userId);
  }

  @Post(':id/events/:eventId/interested')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark interest in an event' })
  async markInterested(
    @Param('eventId') eventId: string,
  ) {
    await this.guildsService.markEventInterested(eventId);
  }
}
