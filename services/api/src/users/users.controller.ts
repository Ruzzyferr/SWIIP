import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { UsersService, UpdateProfileDto, SendFriendRequestDto } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('users/@me')
  @ApiOperation({ summary: 'Get current user' })
  async getMe(@CurrentUser() user: AuthUser) {
    return this.usersService.findById(user.userId);
  }

  @Patch('users/@me')
  @ApiOperation({ summary: 'Update current user profile' })
  async updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.userId, dto);
  }

  @Delete('users/@me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete (anonymize) current user account' })
  async deleteMe(@CurrentUser() user: AuthUser) {
    await this.usersService.deleteAccount(user.userId);
  }

  @Get('users/@me/guilds')
  @ApiOperation({ summary: 'Get guilds current user is in' })
  async getMyGuilds(@CurrentUser() user: AuthUser) {
    return this.usersService.getUserGuilds(user.userId);
  }

  @Get('users/@me/relationships')
  @ApiOperation({ summary: 'Get all relationships (friends, blocked, pending)' })
  async getMyRelationships(@CurrentUser() user: AuthUser) {
    return this.usersService.getRelationships(user.userId);
  }

  @Get('users/@me/friends')
  @ApiOperation({ summary: 'Get friends list' })
  async getFriends(@CurrentUser() user: AuthUser) {
    return this.usersService.getFriends(user.userId);
  }

  @Post('users/@me/relationships')
  @ApiOperation({ summary: 'Send friend request by username#discriminator' })
  async sendFriendRequest(
    @CurrentUser() user: AuthUser,
    @Body() dto: SendFriendRequestDto,
  ) {
    return this.usersService.sendFriendRequest(
      user.userId,
      dto.username,
      dto.discriminator,
    );
  }

  @Put('users/@me/relationships/:targetId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Accept friend request or update relationship' })
  async acceptFriendRequest(
    @CurrentUser() user: AuthUser,
    @Param('targetId') targetId: string,
  ) {
    await this.usersService.acceptFriendRequest(user.userId, targetId);
  }

  @Put('users/@me/relationships/:targetId/block')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Block a user' })
  async blockUser(
    @CurrentUser() user: AuthUser,
    @Param('targetId') targetId: string,
  ) {
    await this.usersService.blockUser(user.userId, targetId);
  }

  @Delete('users/@me/relationships/:targetId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove friend, decline request, or unblock' })
  @ApiQuery({ name: 'type', required: false, description: 'Pass "unblock" to unblock a user' })
  async removeRelationship(
    @CurrentUser() user: AuthUser,
    @Param('targetId') targetId: string,
    @Query('type') type?: string,
  ) {
    if (type === 'unblock') {
      await this.usersService.unblockUser(user.userId, targetId);
    } else {
      await this.usersService.removeFriend(user.userId, targetId);
    }
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user by ID' })
  async getUser(@Param('id') id: string, @CurrentUser() _user: AuthUser) {
    return this.usersService.findByIdPublic(id);
  }

  @Get('users/:id/profile')
  @ApiOperation({ summary: 'Get user public profile with mutual guilds' })
  async getUserProfile(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.getProfile(id, user.userId);
  }

  @Get('users/:id/mutual-guilds')
  @ApiOperation({ summary: 'Get mutual guilds with a user' })
  async getMutualGuilds(
    @Param('id') targetId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.getMutualGuilds(user.userId, targetId);
  }

  @Post('users/presence')
  @ApiOperation({ summary: 'Get presence for multiple users' })
  async getPresence(
    @Body() body: { userIds: string[] },
  ) {
    // Limit to 200 user IDs to prevent abuse
    const ids = Array.isArray(body.userIds) ? body.userIds.slice(0, 200) : [];
    return this.usersService.getPresence(ids);
  }
}
