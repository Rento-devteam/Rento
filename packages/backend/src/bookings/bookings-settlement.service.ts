import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { BookingSettlementStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  PAYMENT_HOLD_GATEWAY,
  type PaymentHoldGateway,
} from '../payments-hold/payment-hold.gateway';
import { NotificationsService } from '../notifications/notifications.service';

const RETRY_SCHEDULE_MS = [1, 6, 24].map((h) => h * 60 * 60 * 1000);
const MAX_RETRIES = RETRY_SCHEDULE_MS.length;

@Injectable()
export class BookingsSettlementService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_HOLD_GATEWAY)
    private readonly holdGateway: PaymentHoldGateway,
    private readonly notifications: NotificationsService,
  ) {}

  async attemptSettlement(params: { bookingId: string; now?: Date }) {
    const now = params.now ?? new Date();

    const booking = (await this.prisma.booking.findUnique({
      where: { id: params.bookingId },
      select: {
        id: true,
        renterId: true,
        listing: { select: { ownerId: true } },
        paymentHoldId: true,
        rentAmount: true,
        depositAmount: true,
        settlementStatus: true,
        settlementRetryCount: true,
      } as any,
    })) as any;

    if (!booking) {
      throw new ConflictException('Booking not found');
    }
    if (booking.settlementStatus === BookingSettlementStatus.SETTLED) {
      return { bookingId: booking.id, status: 'ok' as const };
    }
    if (!booking.paymentHoldId) {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: {
          settlementStatus: BookingSettlementStatus.FAILED,
          settlementError: 'Missing paymentHoldId',
          settlementLastAttemptAt: now,
        } as any,
      });
      throw new ConflictException('Missing payment hold for settlement');
    }

    const captureKey = `booking_settlement:capture_rent:${booking.id}`;
    const releaseKey = `booking_settlement:release_deposit:${booking.id}`;

    await this.prisma.booking.update({
      where: { id: booking.id },
      data: { settlementLastAttemptAt: now } as any,
    });

    const rent = Number(booking.rentAmount);
    const deposit = Number(booking.depositAmount);
    const rentOk = Number.isFinite(rent) && rent > 0;
    const depositOk = Number.isFinite(deposit) && deposit > 0;

    try {
      if (rentOk) {
        await this.holdGateway.captureRent({
          holdId: booking.paymentHoldId,
          amount: rent,
          currency: 'RUB',
          idempotencyKey: captureKey,
          metadata: { bookingId: booking.id },
        });
      }

      if (depositOk) {
        await this.holdGateway.releaseDeposit({
          holdId: booking.paymentHoldId,
          amount: deposit,
          currency: 'RUB',
          idempotencyKey: releaseKey,
          metadata: { bookingId: booking.id },
        });
      }

      await this.prisma.booking.update({
        where: { id: booking.id },
        data: {
          settlementStatus: BookingSettlementStatus.SETTLED,
          settlementError: null,
          settlementNextRetryAt: null,
          settledAt: now,
        } as any,
      });

      if (depositOk) {
        await this.notifications.notifyRenterDepositReleased({
          bookingId: booking.id,
          renterId: booking.renterId,
          amount: deposit,
        });
      }
      await this.notifications.notifyLandlordBookingCompleted({
        bookingId: booking.id,
        landlordId: booking.listing.ownerId,
      });

      return { bookingId: booking.id, status: 'ok' as const };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const next = this.computeNextRetryAt(now, booking.settlementRetryCount);

      await this.prisma.booking.update({
        where: { id: booking.id },
        data: {
          settlementStatus: BookingSettlementStatus.FAILED,
          settlementError: message,
          settlementRetryCount: { increment: 1 },
          settlementNextRetryAt: next,
        } as any,
      });

      throw err;
    }
  }

  private computeNextRetryAt(now: Date, currentRetryCount: number) {
    if (currentRetryCount >= MAX_RETRIES) {
      return null;
    }
    return new Date(now.getTime() + RETRY_SCHEDULE_MS[currentRetryCount]);
  }
}

