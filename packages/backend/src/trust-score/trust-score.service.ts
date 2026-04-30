import { Injectable, NotFoundException } from '@nestjs/common';
import { BookingSettlementStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { TrustScoreSnapshot } from '../users/user-profile.mapper';

const VERIFICATION_WEIGHT = 0.2;
const RATING_WEIGHT = 0.3;
const RELIABILITY_WEIGHT = 0.5;
const NEUTRAL_RATING_FACTOR = 0.5;

@Injectable()
export class TrustScoreService {
  constructor(private readonly prismaService: PrismaService) {}

  async getTrustScoreForUser(userId: string): Promise<TrustScoreSnapshot> {
    const [user, stored] = await Promise.all([
      this.prismaService.user.findUnique({
        where: { id: userId },
        select: { id: true },
      }),
      this.prismaService.trustScore.findUnique({
        where: { userId },
        select: {
          currentScore: true,
          totalDeals: true,
          successfulDeals: true,
          lateReturns: true,
          disputes: true,
          calculatedAt: true,
        },
      }),
    ]);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!stored) {
      // Backfill on first read so historic completed deals are reflected immediately.
      return this.recalculateForUser({
        userId,
        eventType: 'profile_read_backfill',
      });
    }

    return {
      currentScore: stored.currentScore,
      totalDeals: stored.totalDeals,
      successfulDeals: stored.successfulDeals,
      lateReturns: stored.lateReturns,
      disputes: stored.disputes,
      calculatedAt: stored.calculatedAt.toISOString(),
    };
  }

  async recalculateForUser(params: {
    userId: string;
    eventType: string;
  }): Promise<TrustScoreSnapshot> {
    // Event types are accepted for compatibility with OpenAPI; calculation derives score from current DB state.
    const user = await this.prismaService.user.findUnique({
      where: { id: params.userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const now = new Date();
    const identityVerification =
      await this.prismaService.identityVerification.findUnique({
        where: { userId: params.userId },
        select: { status: true },
      });

    const baseCompletedWhere: Prisma.BookingWhereInput = {
      status: 'COMPLETED' as const,
      OR: [
        { renterId: params.userId },
        { listing: { ownerId: params.userId } },
      ],
    };

    const [totalDeals, completedDeals] = await Promise.all([
      this.prismaService.booking.count({
        where: baseCompletedWhere,
      }),
      this.prismaService.booking.findMany({
        where: {
          ...baseCompletedWhere,
          completedAt: { not: null },
        },
        select: {
          id: true,
          endAt: true,
          endDate: true,
          completedAt: true,
          depositAmount: true,
          settledAt: true,
          settlementStatus: true,
          returnMutualConfirmedAt: true,
          returnAutoConfirmedAt: true,
        },
      }),
    ]);

    const depositSlaMs = this.getDepositReturnSlaMs();

    let lateReturnsTotal = 0;
    for (const b of completedDeals) {
      const completedAt = b.completedAt;
      if (!completedAt) continue;

      const deposit = Number(b.depositAmount);
      const hasDeposit = Number.isFinite(deposit) && deposit > 0;

      if (hasDeposit) {
        const anchor = b.returnMutualConfirmedAt ?? b.returnAutoConfirmedAt;
        if (!anchor) continue;
        if (
          b.settlementStatus !== BookingSettlementStatus.SETTLED ||
          !b.settledAt
        ) {
          continue;
        }
        const dueByDeposit = anchor.getTime() + depositSlaMs;
        if (b.settledAt.getTime() > dueByDeposit) {
          lateReturnsTotal += 1;
        }
        continue;
      }

      const dueAt = b.endAt ?? this.endOfDay(b.endDate);
      if (completedAt.getTime() > dueAt.getTime()) {
        lateReturnsTotal += 1;
      }
    }
    lateReturnsTotal = Math.min(totalDeals, lateReturnsTotal);
    const successfulDeals = Math.max(0, totalDeals - lateReturnsTotal);

    const reliabilityFactor = totalDeals > 0 ? successfulDeals / totalDeals : 0;

    const verificationFactor =
      identityVerification?.status === 'VERIFIED' ? 1 : 0;
    // Reviews entity is not implemented yet in schema, so we keep a neutral
    // factor to avoid penalizing users for missing subsystem data.
    const ratingFactor = NEUTRAL_RATING_FACTOR;
    const ars =
      verificationFactor * VERIFICATION_WEIGHT +
      ratingFactor * RATING_WEIGHT +
      reliabilityFactor * RELIABILITY_WEIGHT;
    const currentScore = this.clampInt(Math.round(ars * 100), 0, 100);

    const disputes = 0;

    const saved = await this.prismaService.trustScore.upsert({
      where: { userId: params.userId },
      create: {
        userId: params.userId,
        currentScore,
        totalDeals,
        successfulDeals,
        lateReturns: lateReturnsTotal,
        disputes,
        calculatedAt: now,
      },
      update: {
        currentScore,
        totalDeals,
        successfulDeals,
        lateReturns: lateReturnsTotal,
        disputes,
        calculatedAt: now,
      },
      select: {
        currentScore: true,
        totalDeals: true,
        successfulDeals: true,
        lateReturns: true,
        disputes: true,
        calculatedAt: true,
      },
    });

    return {
      currentScore: saved.currentScore,
      totalDeals: saved.totalDeals,
      successfulDeals: saved.successfulDeals,
      lateReturns: saved.lateReturns,
      disputes: saved.disputes,
      calculatedAt: saved.calculatedAt.toISOString(),
    };
  }

  private clampInt(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }

  private endOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  /** SLA from mutual (or auto) return confirm until deposit must be settled in the stub/real gateway. */
  private getDepositReturnSlaMs(): number {
    const raw = process.env.DEPOSIT_RETURN_SLA_HOURS;
    const parsed = raw ? Number(raw) : NaN;
    const hours = Number.isFinite(parsed) && parsed > 0 ? parsed : 24;
    return hours * 60 * 60 * 1000;
  }
}
