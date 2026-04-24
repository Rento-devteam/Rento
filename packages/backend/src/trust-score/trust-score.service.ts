import { Injectable, NotFoundException } from '@nestjs/common';
import { IdentityVerificationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { TrustScoreSnapshot } from '../users/user-profile.mapper';

@Injectable()
export class TrustScoreService {
  constructor(private readonly prismaService: PrismaService) {}

  async getTrustScoreForUser(userId: string): Promise<TrustScoreSnapshot> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const verification = await this.prismaService.identityVerification.findUnique({
      where: { userId },
      select: { status: true },
    });

    const bonus =
      Number(process.env.TRUST_SCORE_VERIFICATION_BONUS ?? '20') || 20;

    const verifiedBonus =
      verification?.status === IdentityVerificationStatus.VERIFIED ? bonus : 0;

    return {
      currentScore: verifiedBonus,
      totalDeals: 0,
      successfulDeals: 0,
      lateReturns: 0,
      disputes: 0,
      calculatedAt: new Date().toISOString(),
    };
  }

  async recalculateForUser(params: {
    userId: string;
    eventType: string;
  }): Promise<TrustScoreSnapshot> {
    // Event types are accepted for compatibility with OpenAPI;
    // MVP implementation derives trust score from current DB state.
    return this.getTrustScoreForUser(params.userId);
  }
}

