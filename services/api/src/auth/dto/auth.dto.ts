import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'alice@swiip.dev' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'alice', minLength: 2, maxLength: 32 })
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'Username can only contain letters, numbers, dots, underscores, and hyphens',
  })
  username: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}

export class LoginDto {
  @ApiProperty({ example: 'alice@swiip.dev' })
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  password: string;

  @ApiPropertyOptional({ description: 'MFA code if enabled' })
  @IsOptional()
  @IsString()
  mfaCode?: string;
}

export class RefreshTokenDto {
  @ApiPropertyOptional({ description: 'Optional fallback when cookie is unavailable' })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class VerifyEmailDto {
  @ApiProperty({ example: '123456', description: '6-digit verification code' })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code: string;
}

export class RequestPasswordResetDto {
  @ApiProperty()
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class EnableMFADto {
  @ApiProperty({ minLength: 6, maxLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code: string;
}

export class DisableMFADto {
  @ApiProperty({ description: 'Current TOTP code or backup code' })
  @IsString()
  code: string;

  @ApiProperty({ description: 'Current password for confirmation' })
  @IsString()
  password: string;
}
