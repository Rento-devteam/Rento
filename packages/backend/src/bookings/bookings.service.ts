import { Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { eachUtcDateInclusive, utcDateOnly } from '../util/date-only';
import { mapBookingDetail, mapBookingListItem } from './booking-list.mapper';
import { CALENDAR_BLOCKING_BOOKING_STATUSES } from './bookings.constants';

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getBlockingBookingsInRange(
    listingId: string,
    rangeStart: Date,
    rangeEnd: Date,
  ) {
    return this.prisma.booking.findMany({
      where: {
        listingId,
        status: { in: CALENDAR_BLOCKING_BOOKING_STATUSES },
        // Day projection keeps calendar day-view stable even for hour-based rentals.
        AND: [
          { startDate: { lte: rangeEnd } },
          { endDate: { gte: rangeStart } },
        ],
      },
      select: {
        startDate: true,
        endDate: true,
      },
    });
  }

  bookingDatesCoveringRange(
    bookings: Array<{ startDate: Date; endDate: Date }>,
    rangeStart: Date,
    rangeEnd: Date,
  ): Set<string> {
    const booked = new Set<string>();
    for (const row of bookings) {
      const from = row.startDate > rangeStart ? row.startDate : rangeStart;
      const to = row.endDate < rangeEnd ? row.endDate : rangeEnd;
      for (const d of eachUtcDateInclusive(
        utcDateOnly(from),
        utcDateOnly(to),
      )) {
        booked.add(d);
      }
    }
    return booked;
  }

  async hasBlockingBookingOverlap(
    listingId: string,
    rangeStart: Date,
    rangeEnd: Date,
  ): Promise<boolean> {
    const rows = await this.prisma.booking.findFirst({
      where: {
        listingId,
        status: { in: CALENDAR_BLOCKING_BOOKING_STATUSES },
        AND: [
          { startDate: { lte: rangeEnd } },
          { endDate: { gte: rangeStart } },
        ],
      },
      select: { id: true },
    });
    return rows !== null;
  }

  cancelBlockingBookingsInRange(
    tx: Prisma.TransactionClient,
    listingId: string,
    rangeStart: Date,
    rangeEnd: Date,
  ) {
    return tx.booking.updateMany({
      where: {
        listingId,
        status: { in: CALENDAR_BLOCKING_BOOKING_STATUSES },
        AND: [
          { startDate: { lte: rangeEnd } },
          { endDate: { gte: rangeStart } },
        ],
      },
      data: { status: BookingStatus.CANCELLED },
    });
  }

  async listBookingsAsRenter(userId: string) {
    const rows = await this.prisma.booking.findMany({
      where: { renterId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        listing: { select: { id: true, title: true } },
        renter: { select: { id: true, fullName: true, email: true } },
      },
    });
    return { items: rows.map((r) => mapBookingListItem(r, 'renter')) };
  }

  async listBookingsAsLandlord(ownerId: string) {
    const rows = await this.prisma.booking.findMany({
      where: { listing: { ownerId } },
      orderBy: { createdAt: 'desc' },
      include: {
        listing: { select: { id: true, title: true } },
        renter: { select: { id: true, fullName: true, email: true } },
      },
    });
    return { items: rows.map((r) => mapBookingListItem(r, 'landlord')) };
  }

  async getBookingForParticipant(bookingId: string, userId: string) {
    const row = await this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        OR: [{ renterId: userId }, { listing: { ownerId: userId } }],
      },
      include: {
        listing: { select: { id: true, title: true, ownerId: true } },
        renter: { select: { id: true, fullName: true, email: true } },
      },
    });
    if (!row) {
      throw new NotFoundException('Booking not found');
    }
    const role = row.renterId === userId ? 'renter' : 'landlord';
    return mapBookingDetail(row, role);
  }
}
