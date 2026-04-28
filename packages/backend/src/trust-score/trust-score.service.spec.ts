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
    prismaService.booking.count.mockResolvedValueOnce(10);

    // completedAt compared with due endAt/endDate: 2 late out of 4 completed
    prismaService.booking.findMany.mockResolvedValue([
      {
        id: 'b1',
        endAt: new Date('2026-01-01T10:00:00.000Z'),
        endDate: new Date('2026-01-01T00:00:00.000Z'),
        completedAt: new Date('2026-01-01T11:00:00.000Z'),
        depositAmount: 0,
        settledAt: null,
        settlementStatus: 'SETTLED',
        returnMutualConfirmedAt: null,
        returnAutoConfirmedAt: null,
      },
      {
        id: 'b2',
        endAt: new Date('2026-01-01T10:00:00.000Z'),
        endDate: new Date('2026-01-01T00:00:00.000Z'),
        completedAt: new Date('2026-01-01T09:00:00.000Z'),
        depositAmount: 0,
        settledAt: null,
        settlementStatus: 'SETTLED',
        returnMutualConfirmedAt: null,
        returnAutoConfirmedAt: null,
      },
      {
        id: 'b3',
        endAt: null,
        endDate: new Date('2026-01-01T00:00:00.000Z'),
        completedAt: new Date('2026-01-01T23:00:00.000Z'),
        depositAmount: 0,
        settledAt: null,
        settlementStatus: 'SETTLED',
        returnMutualConfirmedAt: null,
        returnAutoConfirmedAt: null,
      },
      {
        id: 'b4',
        endAt: null,
        endDate: new Date('2026-01-01T00:00:00.000Z'),
        completedAt: new Date('2026-01-02T00:30:00.000Z'),
        depositAmount: 0,
        settledAt: null,
        settlementStatus: 'SETTLED',
        returnMutualConfirmedAt: null,
        returnAutoConfirmedAt: null,
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

  it('treats deposit return on time by settledAt within SLA after mutual confirm', async () => {
    prismaService.user.findUnique.mockResolvedValue({ id: 'u1' });
    prismaService.identityVerification.findUnique.mockResolvedValue({
      status: 'VERIFIED',
    });

    prismaService.booking.count.mockResolvedValueOnce(1);
    const mutual = new Date('2026-01-01T12:00:00.000Z');
    const settled = new Date('2026-01-01T14:00:00.000Z');
    prismaService.booking.findMany.mockResolvedValue([
      {
        id: 'b1',
        endAt: new Date('2026-01-01T12:00:00.000Z'),
        endDate: new Date('2026-01-01T00:00:00.000Z'),
        completedAt: mutual,
        depositAmount: 100,
        settledAt: settled,
        settlementStatus: 'SETTLED',
        returnMutualConfirmedAt: mutual,
        returnAutoConfirmedAt: null,
      },
    ]);

    prismaService.trustScore.upsert.mockResolvedValue({
      currentScore: 70,
      totalDeals: 1,
      successfulDeals: 1,
      lateReturns: 0,
      disputes: 0,
      calculatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });

    await service.recalculateForUser({
      userId: 'u1',
      eventType: 'booking_completed',
    });

    expect(prismaService.trustScore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          totalDeals: 1,
          lateReturns: 0,
          successfulDeals: 1,
        }),
      }),
    );
  });

  it('counts late deposit return when settled after SLA from mutual confirm', async () => {
    prismaService.user.findUnique.mockResolvedValue({ id: 'u1' });
    prismaService.identityVerification.findUnique.mockResolvedValue({
      status: 'VERIFIED',
    });

    prismaService.booking.count.mockResolvedValueOnce(1);
    const mutual = new Date('2026-01-01T12:00:00.000Z');
    const settled = new Date('2026-01-03T14:00:00.000Z');
    prismaService.booking.findMany.mockResolvedValue([
      {
        id: 'b1',
        endAt: new Date('2026-01-01T12:00:00.000Z'),
        endDate: new Date('2026-01-01T00:00:00.000Z'),
        completedAt: mutual,
        depositAmount: 100,
        settledAt: settled,
        settlementStatus: 'SETTLED',
        returnMutualConfirmedAt: mutual,
        returnAutoConfirmedAt: null,
      },
    ]);

    prismaService.trustScore.upsert.mockResolvedValue({
      currentScore: 60,
      totalDeals: 1,
      successfulDeals: 0,
      lateReturns: 1,
      disputes: 0,
      calculatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });

    await service.recalculateForUser({
      userId: 'u1',
      eventType: 'booking_completed',
    });

    expect(prismaService.trustScore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          totalDeals: 1,
          lateReturns: 1,
          successfulDeals: 0,
        }),
      }),
    );
  });
});
