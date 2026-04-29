import { BadRequestException } from '@nestjs/common';
import { IdentityVerificationStatus } from '@prisma/client';
import { VerificationService } from './verification.service';

describe('VerificationService', () => {
  const prismaService = {
    identityVerification: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
  };

  const provider = {
    getAuthorizationRedirectUrl: jest.fn(),
    exchangeCodeForAssertion: jest.fn(),
  };

  let service: VerificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VerificationService(prismaService as never, provider);
  });

  it('rejects initiate when already verified', async () => {
    prismaService.identityVerification.findUnique.mockResolvedValue({
      id: 'a1',
      userId: 'u1',
      status: IdentityVerificationStatus.VERIFIED,
    });

    await expect(service.initiateEsiaVerification('u1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('returns redirectUrl on initiate', async () => {
    prismaService.identityVerification.findUnique.mockResolvedValue(null);
    prismaService.identityVerification.upsert.mockResolvedValue({
      id: 'a1',
      userId: 'u1',
      status: IdentityVerificationStatus.PENDING,
    });
    provider.getAuthorizationRedirectUrl.mockResolvedValue(
      'http://example.com/redirect',
    );

    const result = await service.initiateEsiaVerification('u1');

    expect(result.redirectUrl).toBe('http://example.com/redirect');
    expect(provider.getAuthorizationRedirectUrl).toHaveBeenCalledWith({
      userId: 'u1',
      attemptId: 'a1',
    });
  });

  it('marks as rejected on callback error', async () => {
    prismaService.identityVerification.findUnique.mockResolvedValue({
      id: 'a1',
      userId: 'u1',
      status: IdentityVerificationStatus.PENDING,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const result = await service.handleEsiaCallback({
      attemptId: 'a1',
      error: 'access_denied',
    });

    expect(prismaService.identityVerification.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: {
        status: IdentityVerificationStatus.REJECTED,
        lastError: 'access_denied',
      },
    });
    expect(result.status).toBe(IdentityVerificationStatus.REJECTED);
    expect(result.userId).toBe('u1');
  });

  it('marks as verified on callback code', async () => {
    prismaService.identityVerification.findUnique.mockResolvedValue({
      id: 'a1',
      userId: 'u1',
      status: IdentityVerificationStatus.PENDING,
      expiresAt: new Date(Date.now() + 60_000),
    });
    provider.exchangeCodeForAssertion.mockResolvedValue({
      provider: 'ESIA',
      subject: 'stub:u1',
      assertedAt: new Date(),
    });

    const result = await service.handleEsiaCallback({
      attemptId: 'a1',
      code: 'stub_code',
    });

    expect(provider.exchangeCodeForAssertion).toHaveBeenCalled();
    expect(prismaService.identityVerification.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: {
        status: IdentityVerificationStatus.VERIFIED,
        verifiedAt: expect.any(Date),
        lastError: null,
      },
    });
    expect(result.status).toBe(IdentityVerificationStatus.VERIFIED);
    expect(result.userId).toBe('u1');
  });
});
