import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { RoomsService, QualityProfile } from './rooms.service';
import { InternalTokenGuard } from '../guards/internal-token.guard';

class JoinRoomDto {
  @IsString() userId!: string;
  @IsString() username!: string;
  @IsBoolean() @IsOptional() canPublish?: boolean;
  @IsBoolean() @IsOptional() canSubscribe?: boolean;
  @IsEnum(['720p30', '1080p30', '1080p60', 'auto']) @IsOptional()
  screenShareQuality?: QualityProfile;
}

class StartScreenShareDto {
  @IsString() userId!: string;
  @IsString() username!: string;
  @IsEnum(['720p30', '1080p30', '1080p60', 'auto'])
  quality!: QualityProfile;
}

@ApiTags('Rooms')
@ApiBearerAuth()
@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Post(':guildId/:channelId/join')
  @HttpCode(HttpStatus.OK)
  @UseGuards(InternalTokenGuard)
  @ApiOperation({ summary: 'Get a LiveKit token to join a voice/video channel' })
  async join(
    @Param('guildId') guildId: string,
    @Param('channelId') channelId: string,
    @Body() dto: JoinRoomDto,
  ) {
    return this.rooms.joinRoom({
      userId: dto.userId,
      username: dto.username,
      guildId,
      channelId,
      canPublish: dto.canPublish ?? true,
      canSubscribe: dto.canSubscribe ?? true,
      canPublishData: true,
    });
  }

  @Post(':guildId/:channelId/screen-share')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a LiveKit token for screen sharing' })
  async startScreenShare(
    @Param('guildId') guildId: string,
    @Param('channelId') channelId: string,
    @Body() dto: StartScreenShareDto,
  ) {
    return this.rooms.startScreenShare({
      userId: dto.userId,
      username: dto.username,
      guildId,
      channelId,
      quality: dto.quality,
    });
  }

  @Get(':guildId/:channelId/participants')
  @ApiOperation({ summary: 'List current participants in a voice channel' })
  async getParticipants(
    @Param('guildId') guildId: string,
    @Param('channelId') channelId: string,
  ) {
    return this.rooms.getRoomParticipants(guildId, channelId);
  }

  @Delete(':guildId/:channelId/participants/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(InternalTokenGuard)
  @ApiOperation({ summary: 'Remove a participant (mod action)' })
  async removeParticipant(
    @Param('guildId') guildId: string,
    @Param('channelId') channelId: string,
    @Param('userId') userId: string,
  ) {
    await this.rooms.removeParticipant(guildId, channelId, userId);
  }

  @Get('constraints/:quality')
  @ApiOperation({ summary: 'Get screen share quality constraints for a profile' })
  getConstraints(@Param('quality') quality: QualityProfile) {
    return this.rooms.getScreenShareConstraints(quality);
  }
}
