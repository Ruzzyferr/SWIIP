import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DMsService } from './dms.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth.service';
import { IsString, IsArray, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDMDto {
  @ApiProperty() @IsString() recipientId: string;
}

export class CreateGroupDMDto {
  @ApiProperty({ type: [String] }) @IsArray() recipientIds: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) name?: string;
}

@ApiTags('Direct Messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class DMsController {
  constructor(private readonly dmsService: DMsService) {}

  @Get('users/@me/conversations')
  @ApiOperation({ summary: 'Get all DM conversations' })
  async getConversations(@CurrentUser() user: AuthUser) {
    return this.dmsService.getDMConversations(user.userId);
  }

  @Post('users/@me/channels')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Open or get existing DM with a user' })
  async createDM(@CurrentUser() user: AuthUser, @Body() dto: CreateDMDto) {
    return this.dmsService.getOrCreateDM(user.userId, dto.recipientId);
  }

  @Post('users/@me/group-channels')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a group DM' })
  async createGroupDM(@CurrentUser() user: AuthUser, @Body() dto: CreateGroupDMDto) {
    return this.dmsService.createGroupDM(user.userId, dto.recipientIds, dto.name);
  }

  @Get('users/@me/conversations/:conversationId')
  @ApiOperation({ summary: 'Get a DM conversation' })
  async getDMChannel(
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.dmsService.getDMChannel(conversationId, user.userId);
  }

  @Post('users/@me/conversations/:conversationId/recipients/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Add a user to a group DM' })
  async addMember(
    @Param('conversationId') conversationId: string,
    @Param('userId') targetId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.dmsService.addGroupDMMember(conversationId, user.userId, targetId);
  }

  @Delete('users/@me/conversations/:conversationId/recipients/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a user from a group DM or leave' })
  async removeMember(
    @Param('conversationId') conversationId: string,
    @Param('userId') targetId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.dmsService.removeGroupDMMember(conversationId, user.userId, targetId);
  }

  @Get('users/@me/conversations/:conversationId/messages')
  @ApiOperation({ summary: 'Get messages in a DM' })
  async getMessages(
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: AuthUser,
    @Query('before') before?: string,
    @Query('after') after?: string,
    @Query('limit') limit?: number,
  ) {
    return this.dmsService.getDMMessages(conversationId, user.userId, {
      before,
      after,
      limit,
    });
  }
}
