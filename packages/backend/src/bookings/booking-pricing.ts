import { BadRequestException } from '@nestjs/common';
import { RentalPeriod } from '@prisma/client';

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export function computeUnits(
  rentalPeriod: RentalPeriod,
  startAt: Date,
  endAt: Date,
): number {
  const ms = endAt.getTime() - startAt.getTime();
  if (!Number.isFinite(ms) || ms <= 0) {
    throw new BadRequestException('Invalid booking interval');
  }

  switch (rentalPeriod) {
    case RentalPeriod.HOUR:
      return Math.ceil(ms / MS_PER_HOUR);
    case RentalPeriod.DAY:
      return Math.ceil(ms / MS_PER_DAY);
    case RentalPeriod.WEEK:
      return Math.ceil(ms / (7 * MS_PER_DAY));
    case RentalPeriod.MONTH:
      // For simplicity: 30-day months for pricing units. Replace with calendar-month math if needed.
      return Math.ceil(ms / (30 * MS_PER_DAY));
    default:
      throw new BadRequestException('Unsupported rental period');
  }
}
