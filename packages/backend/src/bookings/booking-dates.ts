import { BadRequestException } from '@nestjs/common';
import { utcDateOnly } from '../util/date-only';

export function computeDayProjection(startAt: Date, endAt: Date): {
  startDate: Date;
  endDate: Date;
} {
  if (startAt.getTime() >= endAt.getTime()) {
    throw new BadRequestException('Invalid booking interval');
  }
  const startDate = utcDateOnly(startAt);
  const endMinusEpsilon = new Date(endAt.getTime() - 1);
  const endDate = utcDateOnly(endMinusEpsilon);
  return { startDate, endDate };
}

