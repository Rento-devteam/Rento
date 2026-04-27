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
  LISTING_DESCRIPTION_MIN,
  LISTING_PRICE_MAX,
  LISTING_TITLE_MAX,
  LISTING_TITLE_MIN,
} from '../listing.constants';

export class UpdateListingDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MinLength(LISTING_TITLE_MIN, {
    message: `Название не короче ${LISTING_TITLE_MIN} символов`,
  })
  @MaxLength(LISTING_TITLE_MAX, {
    message: `Название не длиннее ${LISTING_TITLE_MAX} символов`,
  })
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(LISTING_DESCRIPTION_MIN, {
    message: `Описание не короче ${LISTING_DESCRIPTION_MIN} символов`,
  })
  @MaxLength(LISTING_DESCRIPTION_MAX, {
    message: `Описание не длиннее ${LISTING_DESCRIPTION_MAX} символов`,
  })
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Цена аренды должна быть больше нуля' })
  @Max(LISTING_PRICE_MAX, { message: 'Слишком большая цена аренды' })
  rentalPrice?: number;

  @IsOptional()
  @IsEnum(RentalPeriod)
  rentalPeriod?: RentalPeriod;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Залог не может быть отрицательным' })
  @Max(LISTING_PRICE_MAX, { message: 'Слишком большой залог' })
  depositAmount?: number;

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
}
