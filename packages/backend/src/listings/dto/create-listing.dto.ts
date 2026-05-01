import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { RentalPeriod } from '@prisma/client';
import {
  LISTING_DESCRIPTION_MAX,
  LISTING_PRICE_MAX,
  LISTING_TITLE_MAX,
  LISTING_TITLE_MIN,
} from '../listing.constants';

export class CreateListingDto {
  @IsUUID()
  categoryId!: string;

  @IsString()
  @MinLength(LISTING_TITLE_MIN, {
    message: `Название не короче ${LISTING_TITLE_MIN} символов`,
  })
  @MaxLength(LISTING_TITLE_MAX, {
    message: `Название не длиннее ${LISTING_TITLE_MAX} символов`,
  })
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(LISTING_DESCRIPTION_MAX, {
    message: `Описание не длиннее ${LISTING_DESCRIPTION_MAX} символов`,
  })
  description?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Цена аренды должна быть больше нуля' })
  @Max(LISTING_PRICE_MAX, { message: 'Слишком большая цена аренды' })
  rentalPrice!: number;

  @IsEnum(RentalPeriod)
  rentalPeriod!: RentalPeriod;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Залог не может быть отрицательным' })
  @Max(LISTING_PRICE_MAX, { message: 'Слишком большой залог' })
  depositAmount!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500, {
    message: 'Текст адреса не длиннее 500 символов',
  })
  addressText?: string;
}
