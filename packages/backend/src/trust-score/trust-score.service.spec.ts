import { NotFoundException } from '@nestjs/common';
import { TrustScoreService } from './trust-score.service';

describe('TrustScoreService', () => {
  const prismaService = {
    user: {
      findUnique: jest.fn(),
    },
    identityVerification: {
      findUnique: jest.fn(),
    },
  };

  let service: TrustScoreService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TrustScoreService(prismaService as never);
    delete process.env.TRUST_SCORE_VERIFICATION_BONUS;
  });

  it('throws when user is missing', async () => {
    prismaService.user.findUnique.mockResolvedValue(null);

    await expect(service.getTrustScoreForUser('u1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('adds bonus when identity is verified', async () => {
    process.env.TRUST_SCORE_VERIFICATION_BONUS = '42';
    prismaService.user.findUnique.mockResolvedValue({ id: 'u1' });
    prismaService.identityVerification.findUnique.mockResolvedValue({
      status: 'VERIFIED',
    });

    const result = await service.getTrustScoreForUser('u1');

    expect(result.currentScore).toBe(42);
  });
});

