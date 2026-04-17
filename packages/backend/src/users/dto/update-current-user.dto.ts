import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateCurrentUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  avatarUrl?: string;
}
