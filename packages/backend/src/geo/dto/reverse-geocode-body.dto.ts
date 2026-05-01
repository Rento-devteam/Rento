import { Type } from 'class-transformer';
import { IsNumber, Max, Min } from 'class-validator';

export class ReverseGeocodeBodyDto {
  /** WGS84 latitude */
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  /** WGS84 longitude */
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;
}
