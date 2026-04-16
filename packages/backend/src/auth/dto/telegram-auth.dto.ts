import { IsOptional, IsString } from 'class-validator';

export class TelegramAuthDto {
  @IsString()
  telegramId!: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  firstName?: string;
}
