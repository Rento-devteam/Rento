import { IsString, MinLength } from 'class-validator';

export class TelegramVerifyDto {
  @IsString()
  @MinLength(4)
  code!: string;

  @IsString()
  telegramId!: string;
}
