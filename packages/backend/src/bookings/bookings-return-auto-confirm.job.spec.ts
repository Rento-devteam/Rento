import { BookingSettlementStatus, BookingStatus } from '@prisma/client';
import { BookingsReturnAutoConfirmJob } from './bookings-return-auto-confirm.job';

describe('BookingsReturnAutoConfirmJob', () => {
  const prisma = {
    $transaction: jest.fn(),
    booking: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const settlement = { attemptSettlement: jest.fn() };
  const notifications = { notifyLandlordAutoReturnDeadlineExpired: jest.fn() };
  const trustScoreService = { recalculateForUser: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.DISABLE_SCHEDULED_JOBS;
  });

  it('auto-confirms booking on deadline and triggers settlement', async () => {
    const now = new Date('2026-04-24T12:00:00.000Z');
    jest.useFakeTimers();
    jest.setSystemTime(now.getTime());

    prisma.$transaction.mockImplementation(async (fn: (tx: any) => any) => {
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([{ locked: true }]),
        booking: prisma.booking,
      };
      return fn(tx);
    });

    prisma.booking.findMany
      // deadline expirations
      .mockResolvedValueOnce([
        {
          id: 'b1',
          listing: { ownerId: 'o1' },
          renterId: 'r1',
          settlementStatus: BookingSettlementStatus.NONE,
        },
      ])
      // retries
      .mockResolvedValueOnce([]);

    prisma.booking.findUnique.mockResolvedValue({
      id: 'b1',
      status: BookingStatus.ACTIVE,
      returnAutoConfirmedAt: null,
      settlementStatus: BookingSettlementStatus.NONE,
    });

    prisma.booking.update.mockResolvedValue({
      id: 'b1',
      settlementStatus: BookingSettlementStatus.PENDING,
    });

    const job = new BookingsReturnAutoConfirmJob(
      prisma as never,
      settlement as never,
      notifications as never,
      trustScoreService as never,
    );

    await job.tick();

    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'b1' },
        data: expect.objectContaining({
          returnAutoConfirmedAt: now,
          status: BookingStatus.COMPLETED,
          settlementStatus: BookingSettlementStatus.PENDING,
        }) as unknown,
      }),
    );
    expect(
      notifications.notifyLandlordAutoReturnDeadlineExpired,
    ).toHaveBeenCalledWith({ bookingId: 'b1', landlordId: 'o1' });
    expect(settlement.attemptSettlement).toHaveBeenCalledWith({
      bookingId: 'b1',
      now,
    });

    jest.useRealTimers();
  });

  it('retries failed settlements when nextRetryAt is due', async () => {
    const now = new Date('2026-04-24T12:00:00.000Z');
    jest.useFakeTimers();
    jest.setSystemTime(now.getTime());

    prisma.$transaction.mockImplementation(async (fn: (tx: any) => any) => {
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([{ locked: true }]),
        booking: prisma.booking,
      };
      return fn(tx);
    });

    prisma.booking.findMany
      // deadline expirations
      .mockResolvedValueOnce([])
      // retries
      .mockResolvedValueOnce([{ id: 'b2' }]);

    prisma.booking.update.mockResolvedValue({ id: 'b2' });
    prisma.booking.findUnique.mockResolvedValue({
      settlementStatus: BookingSettlementStatus.SETTLED,
      renterId: 'r1',
      listing: { ownerId: 'o1' },
    });

    const job = new BookingsReturnAutoConfirmJob(
      prisma as never,
      settlement as never,
      notifications as never,
      trustScoreService as never,
    );

    await job.tick();

    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: 'b2' },
      data: { settlementStatus: BookingSettlementStatus.PENDING },
    });
    expect(settlement.attemptSettlement).toHaveBeenCalledWith({
      bookingId: 'b2',
      now,
    });
    expect(trustScoreService.recalculateForUser).toHaveBeenCalledWith({
      userId: 'r1',
      eventType: 'booking_completed',
    });
    expect(trustScoreService.recalculateForUser).toHaveBeenCalledWith({
      userId: 'o1',
      eventType: 'booking_completed',
    });

    jest.useRealTimers();
  });
});
