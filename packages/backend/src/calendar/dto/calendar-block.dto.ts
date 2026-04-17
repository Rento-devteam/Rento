import { Matches, IsOptional, IsString } from 'class-validator';

export class CalendarBlockDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate!: string;

  @IsOptional()
  @IsString()
  reason?: string | null;
}
