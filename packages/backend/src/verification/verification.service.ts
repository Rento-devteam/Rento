import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { IdentityVerificationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { IdentityVerificationProvider } from './providers/identity-verification.provider';

@Injectable()
export class VerificationService {
  constructor(
    private readonly prismaService: PrismaService,
    @Inject('IdentityVerificationProvider')
    private readonly provider: IdentityVerificationProvider,
  ) {}

  async initiateEsiaVerification(
    userId: string,
  ): Promise<{ redirectUrl: string }> {
    const existing = await this.prismaService.identityVerification.findUnique({
      where: { userId },
    });
    if (existing?.status === IdentityVerificationStatus.VERIFIED) {
      throw new BadRequestException('User is already verified');
    }

    const attempt = await this.prismaService.identityVerification.upsert({
      where: { userId },
      create: {
        userId,
        provider: 'ESIA',
        status: IdentityVerificationStatus.PENDING,
        lastError: null,
        verifiedAt: null,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
      update: {
        status: IdentityVerificationStatus.PENDING,
        lastError: null,
        verifiedAt: null,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const redirectUrl = await this.provider.getAuthorizationRedirectUrl({
      userId,
      attemptId: attempt.id,
    });

    return { redirectUrl };
  }

  async handleEsiaCallback(params: {
    attemptId?: string;
    code?: string;
    error?: string;
  }): Promise<{
    status: IdentityVerificationStatus;
    userId: string;
    message?: string;
  }> {
    if (!params.attemptId) {
      throw new BadRequestException('Missing attemptId');
    }

    const attempt = await this.prismaService.identityVerification.findUnique({
      where: { id: params.attemptId },
    });
    if (!attempt) {
      throw new BadRequestException('Verification was not initiated');
    }

    if (attempt.status === IdentityVerificationStatus.VERIFIED) {
      return {
        status: IdentityVerificationStatus.VERIFIED,
        userId: attempt.userId,
      };
    }

    if (params.error) {
      await this.prismaService.identityVerification.update({
        where: { id: attempt.id },
        data: {
          status: IdentityVerificationStatus.REJECTED,
          lastError: params.error,
        },
      });
      return {
        status: IdentityVerificationStatus.REJECTED,
        userId: attempt.userId,
        message: 'Verification cancelled',
      };
    }

    if (!params.code) {
      throw new BadRequestException('Missing code');
    }

    if (attempt.expiresAt && attempt.expiresAt.getTime() < Date.now()) {
      await this.prismaService.identityVerification.update({
        where: { id: attempt.id },
        data: {
          status: IdentityVerificationStatus.EXPIRED,
          lastError: 'expired',
        },
      });
      return {
        status: IdentityVerificationStatus.EXPIRED,
        userId: attempt.userId,
        message: 'Verification expired',
      };
    }

    await this.provider.exchangeCodeForAssertion({
      code: params.code,
      attemptId: attempt.id,
      userId: attempt.userId,
    });

    await this.prismaService.identityVerification.update({
      where: { id: attempt.id },
      data: {
        status: IdentityVerificationStatus.VERIFIED,
        verifiedAt: new Date(),
        lastError: null,
      },
    });

    return {
      status: IdentityVerificationStatus.VERIFIED,
      userId: attempt.userId,
    };
  }

  async escalateEsiaVerification(params: {
    userId: string;
    reason: string;
    comment?: string;
  }): Promise<{ message: string }> {
    // No PII matching is performed; escalation is kept as a stub that records the intent.
    const note = `${params.reason}${params.comment ? `: ${params.comment}` : ''}`;
    await this.prismaService.identityVerification.upsert({
      where: { userId: params.userId },
      create: {
        userId: params.userId,
        provider: 'ESIA',
        status: IdentityVerificationStatus.PENDING,
        lastError: note,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
      update: {
        status: IdentityVerificationStatus.PENDING,
        lastError: note,
      },
    });

    return { message: 'Escalation accepted' };
  }
}
