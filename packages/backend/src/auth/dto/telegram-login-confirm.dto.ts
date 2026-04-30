import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class TelegramLoginConfirmDto {
  @IsString()
  @MinLength(10)
  @MaxLength(256)
  state!: string;

  @IsString()
  @MaxLength(32)
  telegramId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  firstName?: string;
}

