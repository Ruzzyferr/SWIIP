import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class SearchMessagesQuery {
  @IsString() q!: string;
  @IsString() @IsOptional() channel?: string;
  @IsString() @IsOptional() from?: string;
  @IsString() @IsOptional() before?: string;
  @IsString() @IsOptional() after?: string;
  @IsInt() @Min(1) @Max(100) @Type(() => Number) @IsOptional() limit?: number;
  @IsInt() @Min(0) @Type(() => Number) @IsOptional() offset?: number;
}

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('guilds/:guildId/search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get('messages')
  @ApiOperation({ summary: 'Search messages in a guild' })
  async searchMessages(
    @Param('guildId') guildId: string,
    @Query() query: SearchMessagesQuery,
  ) {
    return this.search.searchMessages(
      guildId,
      query.q,
      {
        channelId: query.channel,
        authorId: query.from,
        before: query.before,
        after: query.after,
      },
      query.limit ?? 25,
      query.offset ?? 0,
    );
  }

  @Get('users')
  @ApiOperation({ summary: 'Search members in a guild' })
  async searchUsers(
    @Param('guildId') guildId: string,
    @Query('q') q: string,
    @Query('limit') limit = 10,
  ) {
    return this.search.searchUsers(guildId, q, Number(limit));
  }
}

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('channels/:channelId/search')
export class ChannelSearchController {
  constructor(private readonly search: SearchService) {}

  @Get('messages')
  @ApiOperation({ summary: 'Search messages in a channel (DM or guild channel)' })
  async searchMessages(
    @Param('channelId') channelId: string,
    @Query() query: SearchMessagesQuery,
  ) {
    return this.search.searchChannelMessages(
      channelId,
      query.q,
      {
        authorId: query.from,
        before: query.before,
        after: query.after,
      },
      query.limit ?? 25,
      query.offset ?? 0,
    );
  }
}
