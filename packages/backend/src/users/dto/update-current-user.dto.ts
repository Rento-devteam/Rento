import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

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

  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressText?: string;

  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @Transform(({ value }) =>
    value === null || value === undefined ? value : Number(value),
  )
  @IsNumber()
  @Min(-90)
  @Max(90)
  addressLatitude?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @Transform(({ value }) =>
    value === null || value === undefined ? value : Number(value),
  )
  @IsNumber()
  @Min(-180)
  @Max(180)
  addressLongitude?: number | null;
}
