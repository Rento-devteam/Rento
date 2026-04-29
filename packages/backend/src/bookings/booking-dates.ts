import { BadRequestException } from '@nestjs/common';
import { utcDateOnly } from '../util/date-only';

/** Rejects intervals whose start is already in the past (client clock skew is not compensated). */
export function assertBookingStartsInFuture(startAt: Date): void {
  if (startAt.getTime() < Date.now()) {
    throw new BadRequestException('Дата начала брони должна быть в будущем');
  }
}

export function computeDayProjection(
  startAt: Date,
  endAt: Date,
): {
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
