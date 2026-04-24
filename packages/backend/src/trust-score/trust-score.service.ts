import { Injectable, NotFoundException } from '@nestjs/common';
import { IdentityVerificationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { TrustScoreSnapshot } from '../users/user-profile.mapper';

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
      // Base/default snapshot when score hasn't been calculated/saved yet.
      return {
        currentScore: 50,
        totalDeals: 0,
        successfulDeals: 0,
        lateReturns: 0,
        disputes: 0,
        calculatedAt: new Date().toISOString(),
      };
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

    const verification = await this.prismaService.identityVerification.findUnique({
      where: { userId: params.userId },
      select: { status: true },
    });

    const verificationFactor =
      verification?.status === IdentityVerificationStatus.VERIFIED ? 1 : 0;

    // Reviews are not implemented in backend yet; keep a stable base factor (50%).
    const ratingFactor = 0.5;

    const baseCompletedWhere = {
      status: 'COMPLETED' as const,
      OR: [
        { renterId: params.userId },
        { listing: { ownerId: params.userId } },
      ],
    };

    const [totalDeals, completedDeals] = await Promise.all([
      this.prismaService.booking.count({
        where: baseCompletedWhere as any,
      }),
      this.prismaService.booking.findMany({
        where: {
          ...(baseCompletedWhere as any),
          completedAt: { not: null },
        } as any,
        select: {
          id: true,
          endAt: true,
          endDate: true,
          completedAt: true,
        },
      }),
    ]);

    let lateReturnsTotal = 0;
    for (const b of completedDeals) {
      const completedAt = b.completedAt;
      if (!completedAt) continue;
      const dueAt = b.endAt ?? this.endOfDay(b.endDate);
      if (completedAt.getTime() > dueAt.getTime()) {
        lateReturnsTotal += 1;
      }
    }
    lateReturnsTotal = Math.min(totalDeals, lateReturnsTotal);
    const successfulDeals = Math.max(0, totalDeals - lateReturnsTotal);

    const reliabilityFactor = totalDeals > 0 ? successfulDeals / totalDeals : 0.5;

    const ars =
      verificationFactor * 0.2 + ratingFactor * 0.3 + reliabilityFactor * 0.5;
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
}

