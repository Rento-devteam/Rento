import { IsString, MaxLength, MinLength } from 'class-validator';

export class TelegramLoginExchangeDto {
  @IsString()
  @MinLength(10)
  @MaxLength(256)
  code!: string;
}
