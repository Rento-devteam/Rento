import { IsISO8601 } from 'class-validator';

export class BookingDatetimeRangeDto {
  @IsISO8601({ strict: true })
  startAt!: string;

  @IsISO8601({ strict: true })
  endAt!: string;
}

