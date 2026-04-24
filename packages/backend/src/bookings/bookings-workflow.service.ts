import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  BookingSettlementStatus,
  PaymentMethodStatus,
  Prisma,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  PAYMENT_HOLD_GATEWAY,
  PaymentHoldDeclinedError,
  type PaymentHoldGateway,
} from '../payments-hold/payment-hold.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { BookingsSettlementService } from './bookings-settlement.service';
import { computeDayProjection } from './booking-dates';
import { computeUnits } from './booking-pricing';
import { CALENDAR_BLOCKING_BOOKING_STATUSES } from './bookings.constants';

@Injectable()
export class BookingsWorkflowService {
  private readonly logger = new Logger(BookingsWorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_HOLD_GATEWAY)
    private readonly holdGateway: PaymentHoldGateway,
    private readonly notifications: NotificationsService,
    private readonly settlement: BookingsSettlementService,
  ) {}

  async createBooking(params: {
    renterId: string;
    listingId: string;
    startAtIso: string;
    endAtIso: string;
    cardId?: string;
    stubBalanceRub?: number;
  }) {
    const startAt = this.parseIso(params.startAtIso, 'startAt');
    const endAt = this.parseIso(params.endAtIso, 'endAt');
    if (startAt.getTime() >= endAt.getTime()) {
      throw new BadRequestException('startAt must be before endAt');
    }

    const renter = await this.prisma.user.findUnique({
      where: { id: params.renterId },
      select: { id: true, status: true },
    });
    if (!renter) {
      throw new NotFoundException('User not found');
    }
    if (renter.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Account is not allowed to create bookings');
    }

    const listing = await this.prisma.listing.findUnique({
      where: { id: params.listingId },
      select: {
        id: true,
        ownerId: true,
        rentalPrice: true,
        rentalPeriod: true,
        depositAmount: true,
      },
    });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    if (listing.ownerId === params.renterId) {
      throw new ForbiddenException('You cannot book your own listing');
    }

    const paymentMethod = await this.resolvePaymentMethod(
      params.renterId,
      params.cardId,
    );

    const units = computeUnits(listing.rentalPeriod, startAt, endAt);
    const rentAmount = round2(listing.rentalPrice * units);
    const depositAmount = round2(listing.depositAmount);
    const totalAmount = round2(rentAmount + depositAmount);

    const { startDate, endDate } = computeDayProjection(startAt, endAt);

    const booking = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${listing.id}))`;

      const overlap = await tx.booking.findFirst({
        where: {
          listingId: listing.id,
          status: { in: CALENDAR_BLOCKING_BOOKING_STATUSES },
          OR: [
            // Precise datetime overlap
            {
              AND: [
                { startAt: { not: null } },
                { endAt: { not: null } },
                { startAt: { lt: endAt } },
                { endAt: { gt: startAt } },
              ],
            },
            // Backward-compat overlap by day projection (coarse, but safe)
            {
              AND: [
                { startAt: null },
                { endAt: null },
                { startDate: { lte: endDate } },
                { endDate: { gte: startDate } },
              ],
            },
          ],
        },
        select: { id: true },
      });

      if (overlap) {
        throw new ConflictException('Selected dates are not available');
      }

      return tx.booking.create({
        data: {
          listingId: listing.id,
          renterId: params.renterId,
          startAt,
          endAt,
          startDate,
          endDate,
          rentAmount,
          depositAmount,
          totalAmount,
          status: BookingStatus.PENDING_PAYMENT,
        },
        select: { id: true, listingId: true },
      });
    });

    const idempotencyKey = `booking_hold:${booking.id}:${paymentMethod.token}`;
    try {
      const hold = await this.holdGateway.authorizeHold({
        amount: totalAmount,
        currency: 'RUB',
        paymentMethodToken: paymentMethod.token,
        idempotencyKey,
        metadata: {
          bookingId: booking.id,
          listingId: booking.listingId,
          renterId: params.renterId,
          rentAmount,
          depositAmount,
          ...(params.stubBalanceRub != null &&
          Number.isFinite(params.stubBalanceRub)
            ? { stubBalanceRub: params.stubBalanceRub }
            : {}),
        },
      });

      const updated = await this.prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.CONFIRMED,
          amountHeld: totalAmount,
          paymentHoldId: hold.holdId,
          paymentAuthorizationCode: hold.authorizationCode,
          paymentGateway: 'stub',
        },
        select: {
          id: true,
          status: true,
          paymentHoldId: true,
          amountHeld: true,
        },
      });

      await this.notifications.notifyRenterBookingConfirmed({
        bookingId: updated.id,
        renterId: params.renterId,
      });
      await this.notifications.notifyLandlordNewBooking({
        bookingId: updated.id,
        landlordId: listing.ownerId,
      });

      return { bookingId: updated.id, status: updated.status };
    } catch (err: unknown) {
      this.logger.warn(
        {
          err:
            err instanceof Error
              ? { name: err.name, message: err.message }
              : err,
        },
        'Payment hold failed',
      );

      await this.prisma.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.PAYMENT_FAILED },
      });

      if (err instanceof PaymentHoldDeclinedError) {
        throw new HttpException(
          {
            statusCode: 402,
            message: err.message,
            bookingId: booking.id,
          },
          402,
        );
      }
      throw err;
    }
  }

  async retryPayment(params: {
    renterId: string;
    bookingId: string;
    cardId: string;
    stubBalanceRub?: number;
  }) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: params.bookingId, renterId: params.renterId },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        rentAmount: true,
        depositAmount: true,
        listingId: true,
        listing: { select: { ownerId: true } },
      },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.status !== BookingStatus.PAYMENT_FAILED) {
      throw new ConflictException('Booking is not eligible for retry');
    }

    const paymentMethod = await this.resolvePaymentMethod(
      params.renterId,
      params.cardId,
    );
    const idempotencyKey = `booking_retry_hold:${booking.id}:${paymentMethod.token}`;

    try {
      const hold = await this.holdGateway.authorizeHold({
        amount: booking.totalAmount,
        currency: 'RUB',
        paymentMethodToken: paymentMethod.token,
        idempotencyKey,
        metadata: {
          bookingId: booking.id,
          listingId: booking.listingId,
          renterId: params.renterId,
          rentAmount: booking.rentAmount,
          depositAmount: booking.depositAmount,
          ...(params.stubBalanceRub != null &&
          Number.isFinite(params.stubBalanceRub)
            ? { stubBalanceRub: params.stubBalanceRub }
            : {}),
        },
      });

      const updated = await this.prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.CONFIRMED,
          amountHeld: booking.totalAmount,
          paymentHoldId: hold.holdId,
          paymentAuthorizationCode: hold.authorizationCode,
          paymentGateway: 'stub',
        },
        select: { id: true, status: true },
      });

      await this.notifications.notifyRenterBookingConfirmed({
        bookingId: updated.id,
        renterId: params.renterId,
      });
      await this.notifications.notifyLandlordNewBooking({
        bookingId: updated.id,
        landlordId: booking.listing.ownerId,
      });

      return { bookingId: updated.id, status: updated.status };
    } catch (err) {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.PAYMENT_FAILED },
      });

      if (err instanceof PaymentHoldDeclinedError) {
        throw new HttpException(
          {
            statusCode: 402,
            message: err.message,
            bookingId: booking.id,
          },
          402,
        );
      }
      throw err;
    }
  }

  async confirmReturn(params: { bookingId: string; actorUserId: string }) {
    const now = new Date();

    const { booking, shouldRunSettlement } = await this.prisma.$transaction(
      async (tx) => {
        const booking = await tx.booking.findFirst({
          where: {
            id: params.bookingId,
            OR: [
              { renterId: params.actorUserId },
              { listing: { ownerId: params.actorUserId } },
            ],
          },
          select: {
            id: true,
            status: true,
            renterId: true,
            listingId: true,
            listing: { select: { ownerId: true } },
            rentAmount: true,
            depositAmount: true,
            paymentHoldId: true,
            returnRenterConfirmedAt: true,
            returnLandlordConfirmedAt: true,
            returnMutualConfirmedAt: true,
            returnConfirmationDeadlineAt: true,
            settlementStatus: true,
          },
        });

        if (!booking) {
          throw new NotFoundException('Booking not found');
        }

        if (booking.status === BookingStatus.CANCELLED) {
          throw new ConflictException('Booking is cancelled');
        }
        if (booking.status === BookingStatus.DISPUTED) {
          throw new ConflictException('Booking is disputed');
        }
        if (
          booking.status !== BookingStatus.ACTIVE &&
          booking.status !== BookingStatus.CONFIRMED
        ) {
          throw new ConflictException('Booking is not eligible for return');
        }

        const isRenter = booking.renterId === params.actorUserId;
        const isLandlord = booking.listing.ownerId === params.actorUserId;
        if (!isRenter && !isLandlord) {
          throw new ForbiddenException('Not a participant');
        }

        const data: Prisma.BookingUpdateInput = {};

        if (isRenter && !booking.returnRenterConfirmedAt) {
          data.returnRenterConfirmedAt = now;
          if (!booking.returnConfirmationDeadlineAt) {
            const timeoutHours = this.getReturnConfirmationTimeoutHours();
            data.returnConfirmationDeadlineAt = new Date(
              now.getTime() + timeoutHours * 60 * 60 * 1000,
            );
          }
        }

        if (isLandlord && !booking.returnLandlordConfirmedAt) {
          // TODO: enforce return checklist completion once implemented.
          data.returnLandlordConfirmedAt = now;
        }

        const renterConfirmed =
          booking.returnRenterConfirmedAt || data.returnRenterConfirmedAt;
        const landlordConfirmed =
          booking.returnLandlordConfirmedAt || data.returnLandlordConfirmedAt;

        let shouldRunSettlement = false;
        if (
          renterConfirmed &&
          landlordConfirmed &&
          !booking.returnMutualConfirmedAt
        ) {
          data.returnMutualConfirmedAt = now;
          data.status = BookingStatus.COMPLETED;
          data.completedAt = now;

          if (booking.settlementStatus === BookingSettlementStatus.NONE) {
            data.settlementStatus = BookingSettlementStatus.PENDING;
            shouldRunSettlement = true;
          } else if (
            booking.settlementStatus === BookingSettlementStatus.FAILED
          ) {
            // Allow re-attempt settlement on repeated confirmation call.
            data.settlementStatus = BookingSettlementStatus.PENDING;
            shouldRunSettlement = true;
          }
        }

        const updated = await tx.booking.update({
          where: { id: booking.id },
          data,
          select: {
            id: true,
            paymentHoldId: true,
            rentAmount: true,
            depositAmount: true,
            settlementStatus: true,
          },
        });

        // If it was already mutually confirmed but settlement isn't done, allow retry.
        if (
          !shouldRunSettlement &&
          booking.returnMutualConfirmedAt &&
          booking.settlementStatus !== BookingSettlementStatus.SETTLED &&
          booking.settlementStatus !== BookingSettlementStatus.PENDING
        ) {
          shouldRunSettlement = true;
          await tx.booking.update({
            where: { id: booking.id },
            data: { settlementStatus: BookingSettlementStatus.PENDING },
            select: { id: true },
          });
        }

        return { booking: updated, shouldRunSettlement };
      },
    );

    if (!shouldRunSettlement) {
      return { bookingId: booking.id, status: 'ok' as const };
    }
    await this.settlement.attemptSettlement({ bookingId: booking.id, now });
    return { bookingId: booking.id, status: 'ok' as const };
  }

  private getReturnConfirmationTimeoutHours() {
    const raw = process.env.RETURN_CONFIRMATION_TIMEOUT_HOURS;
    const parsed = raw ? Number(raw) : NaN;
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
    return 24;
  }

  private async resolvePaymentMethod(userId: string, cardId?: string) {
    if (cardId) {
      const method = await this.prisma.userPaymentMethod.findFirst({
        where: { id: cardId, userId, status: PaymentMethodStatus.ATTACHED },
        select: { token: true },
      });
      if (!method) {
        throw new NotFoundException('Payment method not found');
      }
      return method;
    }

    const method = await this.prisma.userPaymentMethod.findFirst({
      where: { userId, status: PaymentMethodStatus.ATTACHED, isDefault: true },
      select: { token: true },
    });
    if (!method) {
      throw new NotFoundException('No default payment method');
    }
    return method;
  }

  private parseIso(value: string, field: string): Date {
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) {
      throw new BadRequestException(`Invalid ${field}`);
    }
    return d;
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
