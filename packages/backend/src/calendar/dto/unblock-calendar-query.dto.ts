import { Matches, IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class UnblockCalendarQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  start!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  end!: string;

  @IsOptional()
  @Transform(({ value }) => coerceQueryBool(value, false))
  @IsBoolean()
  force = false;

  @IsOptional()
  @Transform(({ value }) => coerceQueryBool(value, false))
  @IsBoolean()
  cancelBookings = false;
}

function coerceQueryBool(value: unknown, defaultValue: boolean): boolean {
  if (value === undefined || value === '') {
    return defaultValue;
  }
  if (value === true || value === false) {
    return value;
  }
  if (value === 'true' || value === '1') {
    return true;
  }
  if (value === 'false' || value === '0') {
    return false;
  }
  return defaultValue;
}
