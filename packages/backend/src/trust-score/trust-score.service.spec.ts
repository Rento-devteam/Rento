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
    trustScore: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    booking: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  };

  let service: TrustScoreService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TrustScoreService(prismaService as never);
  });

  it('throws when user is missing', async () => {
    prismaService.user.findUnique.mockResolvedValue(null);
    prismaService.trustScore.findUnique.mockResolvedValue(null);

    await expect(service.getTrustScoreForUser('u1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('returns base score when no stored snapshot exists', async () => {
    prismaService.user.findUnique.mockResolvedValue({ id: 'u1' });
    prismaService.trustScore.findUnique.mockResolvedValue(null);

    const result = await service.getTrustScoreForUser('u1');

    expect(result).toMatchObject({
      currentScore: 50,
      totalDeals: 0,
      successfulDeals: 0,
      lateReturns: 0,
      disputes: 0,
    });
  });

  it('returns stored snapshot when it exists', async () => {
    prismaService.user.findUnique.mockResolvedValue({ id: 'u1' });
    prismaService.trustScore.findUnique.mockResolvedValue({
      currentScore: 77,
      totalDeals: 10,
      successfulDeals: 8,
      lateReturns: 2,
      disputes: 0,
      calculatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await service.getTrustScoreForUser('u1');

    expect(result).toMatchObject({
      currentScore: 77,
      totalDeals: 10,
      successfulDeals: 8,
      lateReturns: 2,
      disputes: 0,
      calculatedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('recalculates and saves trust score snapshot', async () => {
    prismaService.user.findUnique.mockResolvedValue({ id: 'u1' });
    prismaService.identityVerification.findUnique.mockResolvedValue({
      status: 'VERIFIED',
    });

    // totalDeals
    prismaService.booking.count
      .mockResolvedValueOnce(10);

    // completedAt compared with due endAt/endDate: 2 late out of 4 completed
    prismaService.booking.findMany.mockResolvedValue([
      {
        id: 'b1',
        endAt: new Date('2026-01-01T10:00:00.000Z'),
        endDate: new Date('2026-01-01T00:00:00.000Z'),
        completedAt: new Date('2026-01-01T11:00:00.000Z'),
      },
      {
        id: 'b2',
        endAt: new Date('2026-01-01T10:00:00.000Z'),
        endDate: new Date('2026-01-01T00:00:00.000Z'),
        completedAt: new Date('2026-01-01T09:00:00.000Z'),
      },
      {
        id: 'b3',
        endAt: null,
        endDate: new Date('2026-01-01T00:00:00.000Z'),
        completedAt: new Date('2026-01-01T23:00:00.000Z'),
      },
      {
        id: 'b4',
        endAt: null,
        endDate: new Date('2026-01-01T00:00:00.000Z'),
        completedAt: new Date('2026-01-02T00:30:00.000Z'),
      },
    ]);

    prismaService.trustScore.upsert.mockResolvedValue({
      currentScore: 65,
      totalDeals: 10,
      successfulDeals: 8,
      lateReturns: 2,
      disputes: 0,
      calculatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });

    const result = await service.recalculateForUser({
      userId: 'u1',
      eventType: 'booking_completed',
    });

    expect(prismaService.trustScore.upsert).toHaveBeenCalled();
    expect(result).toMatchObject({
      currentScore: 65,
      totalDeals: 10,
      successfulDeals: 8,
      lateReturns: 2,
      disputes: 0,
      calculatedAt: '2026-01-02T00:00:00.000Z',
    });
  });
});

