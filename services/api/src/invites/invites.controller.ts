import { Controller, Get, Post, Delete, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InvitesService } from './invites.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { AuthUser } from '../auth/auth.service';

@ApiTags('Invites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Public()
  @Get('invites/:code')
  @ApiOperation({ summary: 'Resolve an invite code' })
  async resolve(@Param('code') code: string) {
    return this.invitesService.resolve(code);
  }

  @Post('invites/:code')
  @ApiOperation({ summary: 'Join a guild via invite code' })
  async use(@Param('code') code: string, @CurrentUser() user: AuthUser) {
    return this.invitesService.use(code, user.userId);
  }

  @Delete('invites/:code')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an invite' })
  async revoke(@Param('code') code: string, @CurrentUser() user: AuthUser) {
    await this.invitesService.revoke(code, user.userId);
  }

  @Get('guilds/:guildId/invites')
  @ApiOperation({ summary: 'Get all invites for a guild' })
  async getGuildInvites(
    @Param('guildId') guildId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.invitesService.getGuildInvites(guildId, user.userId);
  }
}
