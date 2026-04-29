import { IsOptional, IsString } from 'class-validator';

export class EsiaCallbackQueryDto {
  @IsOptional()
  @IsString()
  attemptId?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  error?: string;
}
