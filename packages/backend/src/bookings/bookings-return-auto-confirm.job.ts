import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  BookingSettlementStatus,
  BookingStatus,
  PaymentMethodStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BookingsSettlementService } from './bookings-settlement.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TrustScoreService } from '../trust-score/trust-score.service';

const JOB_LOCK_KEY = 'job:booking_return_auto_confirm_v1';

@Injectable()
export class BookingsReturnAutoConfirmJob {
  private readonly logger = new Logger(BookingsReturnAutoConfirmJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settlement: BookingsSettlementService,
    private readonly notifications: NotificationsService,
    private readonly trustScoreService: TrustScoreService,
  ) {}

  @Cron('* * * * *') // every minute
  async tick() {
    // Skip in tests unless explicitly enabled.
    if (process.env.DISABLE_SCHEDULED_JOBS === 'true') {
      return;
    }

    const now = new Date();

    const gotLock = await this.prisma.$transaction(async (tx) => {
      const rows = (await tx.$queryRaw<
        Array<{ locked: boolean }>
      >`SELECT pg_try_advisory_xact_lock(hashtext(${JOB_LOCK_KEY})) AS locked;`) as Array<{
        locked: boolean;
      }>;
      return Boolean(rows[0]?.locked);
    });

    if (!gotLock) {
      return;
    }

    await this.processDeadlineExpirations(now);
    await this.processRetries(now);
  }

  private async processDeadlineExpirations(now: Date) {
    const candidates = await this.prisma.booking.findMany({
      where: {
        returnRenterConfirmedAt: { not: null },
        returnLandlordConfirmedAt: null,
        returnAutoConfirmedAt: null,
        returnConfirmationDeadlineAt: { lte: now },
        status: { in: [BookingStatus.ACTIVE, BookingStatus.CONFIRMED] },
      },
      select: {
        id: true,
        listing: { select: { ownerId: true } },
        renterId: true,
        settlementStatus: true,
      },
      take: 50,
      orderBy: { returnConfirmationDeadlineAt: 'asc' },
    });

    for (const b of candidates) {
      try {
        const [renterCard, landlordCard] = await Promise.all([
          this.prisma.userPaymentMethod.findFirst({
            where: {
              userId: b.renterId,
              status: PaymentMethodStatus.ATTACHED,
            },
            select: { id: true },
          }),
          this.prisma.userPaymentMethod.findFirst({
            where: {
              userId: b.listing.ownerId,
              status: PaymentMethodStatus.ATTACHED,
            },
            select: { id: true },
          }),
        ]);
        if (!renterCard || !landlordCard) {
          continue;
        }

        const updated = await this.prisma.$transaction(async (tx) => {
          const current = await tx.booking.findUnique({
            where: { id: b.id },
            select: {
              id: true,
              status: true,
              returnAutoConfirmedAt: true,
              settlementStatus: true,
            },
          });
          if (!current) return null;
          if (current.status === BookingStatus.CANCELLED) return null;
          if (current.status === BookingStatus.DISPUTED) return null;
          if (current.returnAutoConfirmedAt) return null;

          const shouldSetPending =
            current.settlementStatus === BookingSettlementStatus.NONE ||
            current.settlementStatus === BookingSettlementStatus.FAILED;

          return tx.booking.update({
            where: { id: b.id },
            data: {
              returnAutoConfirmedAt: now,
              status: BookingStatus.COMPLETED,
              completedAt: now,
              ...(shouldSetPending
                ? { settlementStatus: BookingSettlementStatus.PENDING }
                : {}),
            },
            select: { id: true, settlementStatus: true },
          });
        });

        if (!updated) continue;

        await this.notifications.notifyLandlordAutoReturnDeadlineExpired({
          bookingId: b.id,
          landlordId: b.listing.ownerId,
        });

        if (updated.settlementStatus === BookingSettlementStatus.PENDING) {
          await this.settlement.attemptSettlement({ bookingId: b.id, now });
        }

        await Promise.allSettled([
          this.trustScoreService.recalculateForUser({
            userId: b.renterId,
            eventType: 'booking_completed',
          }),
          this.trustScoreService.recalculateForUser({
            userId: b.listing.ownerId,
            eventType: 'booking_completed',
          }),
        ]);
      } catch (err) {
        this.logger.warn(
          {
            bookingId: b.id,
            err: err instanceof Error ? err.message : String(err),
          },
          'Auto-confirm settlement attempt failed',
        );
      }
    }
  }

  private async processRetries(now: Date) {
    const retries = await this.prisma.booking.findMany({
      where: {
        settlementStatus: BookingSettlementStatus.FAILED,
        settlementNextRetryAt: { lte: now },
        status: BookingStatus.COMPLETED,
      },
      select: { id: true },
      take: 50,
      orderBy: { settlementNextRetryAt: 'asc' },
    });

    for (const b of retries) {
      try {
        await this.prisma.booking.update({
          where: { id: b.id },
          data: { settlementStatus: BookingSettlementStatus.PENDING },
        });
        await this.settlement.attemptSettlement({ bookingId: b.id, now });

        const after = await this.prisma.booking.findUnique({
          where: { id: b.id },
          select: {
            settlementStatus: true,
            renterId: true,
            listing: { select: { ownerId: true } },
          },
        });
        if (
          after?.settlementStatus === BookingSettlementStatus.SETTLED &&
          after.renterId &&
          after.listing?.ownerId
        ) {
          await Promise.allSettled([
            this.trustScoreService.recalculateForUser({
              userId: after.renterId,
              eventType: 'booking_completed',
            }),
            this.trustScoreService.recalculateForUser({
              userId: after.listing.ownerId,
              eventType: 'booking_completed',
            }),
          ]);
        }
      } catch (err) {
        this.logger.warn(
          {
            bookingId: b.id,
            err: err instanceof Error ? err.message : String(err),
          },
          'Settlement retry failed',
        );
      }
    }
  }
}
