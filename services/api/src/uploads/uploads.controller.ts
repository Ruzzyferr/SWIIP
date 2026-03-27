import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { IsString, IsInt, IsArray, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';

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
export class UploadsController {
  constructor(
    private readonly uploadsService: UploadsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('avatars')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload user avatar' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @CurrentUser() user: AuthUser,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 8 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|gif|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const result = await this.uploadsService.uploadAvatar(user.userId, file);
    await this.prisma.user.update({
      where: { id: user.userId },
      data: { avatarId: result.s3Key },
    });
    return result;
  }

  @Post('banners')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload user banner' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadBanner(
    @CurrentUser() user: AuthUser,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 8 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|gif|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const result = await this.uploadsService.uploadBanner(user.userId, file);
    await this.prisma.user.update({
      where: { id: user.userId },
      data: { bannerId: result.s3Key },
    });
    return result;
  }

  @Post('guild-icons/:guildId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload guild icon' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadGuildIcon(
    @Param('guildId') guildId: string,
    @CurrentUser() user: AuthUser,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 8 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|gif|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const result = await this.uploadsService.uploadGuildIcon(guildId, file);
    await this.prisma.guild.update({
      where: { id: guildId },
      data: { icon: result.s3Key },
    });
    return result;
  }

  @Post('channels/:channelId/attachments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Request presigned URLs for attachment uploads' })
  async presignAttachments(
    @Param('channelId') channelId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: PresignAttachmentsDto,
  ) {
    const results = await Promise.all(
      dto.files.map(async (file) => {
        const presigned = await this.uploadsService.createPresignedUpload(
          channelId,
          user.userId,
          file.filename,
          file.contentType,
          file.fileSize,
        );

        // Create pending attachment in DB (no messageId yet)
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
