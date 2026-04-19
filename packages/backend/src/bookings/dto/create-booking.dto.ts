import { IsOptional, IsUUID } from 'class-validator';
import { BookingDatetimeRangeDto } from './booking-datetime-range.dto';

export class CreateBookingDto extends BookingDatetimeRangeDto {
  @IsUUID()
  listingId!: string;

  @IsOptional()
  @IsUUID()
  cardId?: string;
}
