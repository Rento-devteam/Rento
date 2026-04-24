import { IsOptional, IsString, MaxLength } from 'class-validator';

export class TelegramLoginStartDto {
  /**
   * Relative path (recommended) or absolute URL (allowed only for whitelisted origins).
   * Example: "/telegram/callback"
   */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  redirectUrl?: string;
}

