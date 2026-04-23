import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class RetryBookingPaymentDto {
  @IsUUID()
  cardId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stubBalanceRub?: number;
}
