import { BookingStatus } from '@prisma/client';

/** Bookings that occupy the listing calendar until cancelled or completed. */
export const CALENDAR_BLOCKING_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.CONFIRMED,
  BookingStatus.ACTIVE,
  BookingStatus.DISPUTED,
];
