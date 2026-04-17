import { RentalPeriod } from '@prisma/client';
import { computeUnits } from './booking-pricing';

describe('computeUnits', () => {
  it('rounds up hours for HOUR rentalPeriod', () => {
    const start = new Date('2026-04-17T10:00:00.000Z');
    const end = new Date('2026-04-17T11:01:00.000Z');
    expect(computeUnits(RentalPeriod.HOUR, start, end)).toBe(2);
  });
});

