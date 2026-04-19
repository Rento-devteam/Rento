import { IsUUID } from 'class-validator';

export class RetryBookingPaymentDto {
  @IsUUID()
  cardId!: string;
}
