import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { BookingDatetimeRangeDto } from './booking-datetime-range.dto';

export class CreateBookingDto extends BookingDatetimeRangeDto {
  @IsUUID()
  listingId!: string;

  @IsOptional()
  @IsUUID()
  cardId?: string;

  /** Dev-only: optional «баланс карты» для заглушки холда (см. PaymentHoldGatewayStub). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stubBalanceRub?: number;
}
