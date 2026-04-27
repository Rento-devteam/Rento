import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CALENDAR_BLOCKING_BOOKING_STATUSES } from '../bookings/bookings.constants';
import { BookingsService } from '../bookings/bookings.service';
import {
  defaultUtcMonthRange,
  eachUtcDateInclusive,
  formatISODateUtc,
  parseISODateOnly,
  utcDateOnly,
} from '../util/date-only';

type AvailabilityStatus =
  | 'AVAILABLE'
  | 'BOOKED'
  | 'BLOCKED_BY_OWNER'
  | 'MAINTENANCE';

type CalendarSlot = {
  date: string;
  status: AvailabilityStatus;
  reason: string | null;
};

@Injectable()
export class CalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingsService: BookingsService,
  ) {}

  async getCalendar(
    listingId: string,
    start?: string,
    end?: string,
  ): Promise<{ listingId: string; items: CalendarSlot[] }> {
    await this.assertListingExists(listingId);

    const { rangeStart, rangeEnd } = this.resolveViewRange(start, end);
    const days = eachUtcDateInclusive(rangeStart, rangeEnd);

    const bookings = await this.bookingsService.getBlockingBookingsInRange(
      listingId,
      rangeStart,
      rangeEnd,
    );
    const bookedDays = this.bookingsService.bookingDatesCoveringRange(
      bookings,
      rangeStart,
      rangeEnd,
    );

    const manualBlocks = await this.prisma.listingManualCalendarBlock.findMany({
      where: {
        listingId,
        AND: [
          { startDate: { lte: rangeEnd } },
          { endDate: { gte: rangeStart } },
        ],
      },
    });

    const manualByDay = new Map<string, string | null>();
    for (const block of manualBlocks) {
      const blockStart = utcDateOnly(block.startDate);
      const blockEnd = utcDateOnly(block.endDate);
      const from = blockStart > rangeStart ? blockStart : rangeStart;
      const to = blockEnd < rangeEnd ? blockEnd : rangeEnd;
      if (from.getTime() > to.getTime()) {
        continue;
      }
      for (const d of eachUtcDateInclusive(from, to)) {
        if (!manualByDay.has(d)) {
          manualByDay.set(d, block.reason ?? null);
        }
      }
    }

    const items: CalendarSlot[] = days.map((date) => {
      if (bookedDays.has(date)) {
        return { date, status: 'BOOKED', reason: null };
      }
      const reason = manualByDay.get(date);
      if (reason !== undefined) {
        const status: AvailabilityStatus =
          reason && /maintenance/i.test(reason)
            ? 'MAINTENANCE'
            : 'BLOCKED_BY_OWNER';
        return { date, status, reason };
      }
      return { date, status: 'AVAILABLE', reason: null };
    });

    return { listingId, items };
  }

  async checkRangeAvailability(
    listingId: string,
    start: string,
    end: string,
  ): Promise<{ available: boolean; conflicts: CalendarSlot[] }> {
    await this.assertListingExists(listingId);
    const rangeStart = this.parseDateParam(start, 'start');
    const rangeEnd = this.parseDateParam(end, 'end');
    this.assertRangeOrder(rangeStart, rangeEnd);

    const bookings = await this.bookingsService.getBlockingBookingsInRange(
      listingId,
      rangeStart,
      rangeEnd,
    );
    const bookedDays = this.bookingsService.bookingDatesCoveringRange(
      bookings,
      rangeStart,
      rangeEnd,
    );

    const conflicts: CalendarSlot[] = [];
    for (const d of eachUtcDateInclusive(rangeStart, rangeEnd)) {
      if (bookedDays.has(d)) {
        conflicts.push({ date: d, status: 'BOOKED', reason: null });
      }
    }

    return { available: conflicts.length === 0, conflicts };
  }

  async blockDates(
    ownerId: string,
    listingId: string,
    startDate: string,
    endDate: string,
    reason?: string | null,
  ): Promise<{ listingId: string; items: CalendarSlot[] }> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, ownerId: true },
    });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    if (listing.ownerId !== ownerId) {
      throw new ForbiddenException(
        'You can only manage your own listing calendar',
      );
    }

    const rangeStart = this.parseDateParam(startDate, 'startDate');
    const rangeEnd = this.parseDateParam(endDate, 'endDate');
    this.assertRangeOrder(rangeStart, rangeEnd);

    const overlapsBooking =
      await this.bookingsService.hasBlockingBookingOverlap(
        listingId,
        rangeStart,
        rangeEnd,
      );
    if (overlapsBooking) {
      throw new ConflictException(
        'Selected dates overlap active bookings and cannot be blocked manually',
      );
    }

    const normalizedReason =
      reason === null || reason === undefined ? null : reason.trim() || null;

    await this.prisma.$transaction(async (tx) => {
      const overlapping = await tx.listingManualCalendarBlock.findMany({
        where: {
          listingId,
          AND: [
            { startDate: { lte: rangeEnd } },
            { endDate: { gte: rangeStart } },
          ],
        },
      });

      let mergedStart = rangeStart;
      let mergedEnd = rangeEnd;
      let mergedReason = normalizedReason;
      for (const row of overlapping) {
        if (row.startDate < mergedStart) {
          mergedStart = row.startDate;
        }
        if (row.endDate > mergedEnd) {
          mergedEnd = row.endDate;
        }
        if (!mergedReason && row.reason) {
          mergedReason = row.reason;
        }
      }

      if (overlapping.length > 0) {
        await tx.listingManualCalendarBlock.deleteMany({
          where: { id: { in: overlapping.map((r) => r.id) } },
        });
      }

      await tx.listingManualCalendarBlock.create({
        data: {
          listingId,
          startDate: mergedStart,
          endDate: mergedEnd,
          reason: mergedReason,
        },
      });

      await this.assertListingKeepsBookableFutureDay(listingId, tx);
    });

    const { start: viewStart, end: viewEnd } = defaultUtcMonthRange(rangeStart);
    return this.getCalendar(
      listingId,
      formatISODateUtc(viewStart),
      formatISODateUtc(viewEnd),
    );
  }

  async unblockDates(
    ownerId: string,
    listingId: string,
    start: string,
    end: string,
    force: boolean,
    cancelBookings: boolean,
  ): Promise<{ listingId: string; items: CalendarSlot[] }> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, ownerId: true },
    });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    if (listing.ownerId !== ownerId) {
      throw new ForbiddenException(
        'You can only manage your own listing calendar',
      );
    }

    const rangeStart = this.parseDateParam(start, 'start');
    const rangeEnd = this.parseDateParam(end, 'end');
    this.assertRangeOrder(rangeStart, rangeEnd);

    const bookingOverlap = await this.bookingsService.hasBlockingBookingOverlap(
      listingId,
      rangeStart,
      rangeEnd,
    );

    if (bookingOverlap && !force) {
      throw new ConflictException(
        'Selected dates include active bookings; use force to proceed',
      );
    }
    if (bookingOverlap && force && !cancelBookings) {
      throw new ConflictException(
        'Confirm booking cancellation to force unblock this range',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (bookingOverlap && force && cancelBookings) {
        await this.bookingsService.cancelBlockingBookingsInRange(
          tx,
          listingId,
          rangeStart,
          rangeEnd,
        );
      }

      await tx.listingManualCalendarBlock.deleteMany({
        where: {
          listingId,
          AND: [
            { startDate: { lte: rangeEnd } },
            { endDate: { gte: rangeStart } },
          ],
        },
      });
    });

    const { start: viewStart, end: viewEnd } = defaultUtcMonthRange(rangeStart);
    return this.getCalendar(
      listingId,
      formatISODateUtc(viewStart),
      formatISODateUtc(viewEnd),
    );
  }

  private async assertListingExists(listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true },
    });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
  }

  private resolveViewRange(
    start?: string,
    end?: string,
  ): { rangeStart: Date; rangeEnd: Date } {
    if (start === undefined && end === undefined) {
      const { start: s, end: e } = defaultUtcMonthRange();
      return { rangeStart: s, rangeEnd: e };
    }
    if (!start || !end) {
      throw new BadRequestException('Provide both start and end, or neither');
    }
    const rangeStart = this.parseDateParam(start, 'start');
    const rangeEnd = this.parseDateParam(end, 'end');
    this.assertRangeOrder(rangeStart, rangeEnd);
    return { rangeStart, rangeEnd };
  }

  private parseDateParam(value: string, field: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(`Invalid ${field}`);
    }
    return parseISODateOnly(value);
  }

  private assertRangeOrder(start: Date, end: Date) {
    if (start.getTime() > end.getTime()) {
      throw new BadRequestException('start must be on or before end');
    }
  }

  /**
   * Ensures at least one calendar day in the next 24 months stays available for new bookings
   * (not covered by manual owner blocks and not covered by active bookings).
   */
  private async assertListingKeepsBookableFutureDay(
    listingId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const today = utcDateOnly(new Date());
    const horizon = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth() + 24,
        today.getUTCDate(),
      ),
    );

    const manualBlocks = await tx.listingManualCalendarBlock.findMany({
      where: {
        listingId,
        AND: [{ endDate: { gte: today } }, { startDate: { lte: horizon } }],
      },
      select: { startDate: true, endDate: true },
    });

    const bookings = await tx.booking.findMany({
      where: {
        listingId,
        status: { in: CALENDAR_BLOCKING_BOOKING_STATUSES },
        AND: [{ startDate: { lte: horizon } }, { endDate: { gte: today } }],
      },
      select: { startDate: true, endDate: true },
    });

    const manualDays = new Set<string>();
    for (const block of manualBlocks) {
      const bs = utcDateOnly(block.startDate);
      const be = utcDateOnly(block.endDate);
      const from = bs > today ? bs : today;
      const to = be < horizon ? be : horizon;
      if (from.getTime() > to.getTime()) {
        continue;
      }
      for (const d of eachUtcDateInclusive(from, to)) {
        manualDays.add(d);
      }
    }

    const bookedDays = new Set<string>();
    for (const row of bookings) {
      const bs = utcDateOnly(row.startDate);
      const be = utcDateOnly(row.endDate);
      const from = bs > today ? bs : today;
      const to = be < horizon ? be : horizon;
      if (from.getTime() > to.getTime()) {
        continue;
      }
      for (const d of eachUtcDateInclusive(from, to)) {
        bookedDays.add(d);
      }
    }

    for (const d of eachUtcDateInclusive(today, horizon)) {
      if (!manualDays.has(d) && !bookedDays.has(d)) {
        return;
      }
    }

    throw new BadRequestException(
      'Нельзя заблокировать все доступные даты: оставьте хотя бы один свободный день в пределах двух лет.',
    );
  }
}
