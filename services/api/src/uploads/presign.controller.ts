import {
  Controller,
  Post,
  UseGuards,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsInt, IsArray, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../permissions/permissions.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

class FilePresignRequest {
  @IsString()
  filename: string;

  @IsInt()
  @Min(1)
  @Max(25 * 1024 * 1024)
  fileSize: number;

  @IsString()
  contentType: string;
}

class PresignAttachmentsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FilePresignRequest)
  files: FilePresignRequest[];
}

@ApiTags('Uploads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class PresignController {
  constructor(
    private readonly uploadsService: UploadsService,
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Post('channels/:channelId/attachments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Request presigned URLs for attachment uploads' })
  async presignAttachments(
    @Param('channelId') channelId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: PresignAttachmentsDto,
  ) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: { guildId: true },
    });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }
    if (channel.guildId) {
      const member = await this.prisma.guildMember.findUnique({
        where: { guildId_userId: { guildId: channel.guildId, userId: user.userId } },
      });
      if (!member) {
        throw new ForbiddenException('You are not a member of this guild');
      }
    }

    const results = await Promise.all(
      dto.files.map(async (file) => {
        const presigned = await this.uploadsService.createPresignedUpload(
          channelId,
          user.userId,
          file.filename,
          file.contentType,
          file.fileSize,
        );

        const attachment = await this.prisma.attachment.create({
          data: {
            channelId,
            uploaderId: user.userId,
            filename: presigned.filename,
            originalFilename: file.filename,
            contentType: file.contentType,
            size: BigInt(file.fileSize),
            s3Key: presigned.s3Key,
            cdnUrl: presigned.cdnUrl,
          },
        });

        return {
          uploadUrl: presigned.uploadUrl,
          uploadId: attachment.id,
          filename: presigned.filename,
        };
      }),
    );

    return results;
  }
}
