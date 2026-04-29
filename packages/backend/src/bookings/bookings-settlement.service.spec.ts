import { BookingSettlementStatus } from '@prisma/client';
import { BookingsSettlementService } from './bookings-settlement.service';

describe('BookingsSettlementService', () => {
  const prisma = {
    booking: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const holdGateway = {
    captureRent: jest.fn(),
    releaseDeposit: jest.fn(),
  };

  const notifications = {
    notifyRenterDepositReleased: jest.fn(),
    notifyLandlordBookingCompleted: jest.fn(),
  };

  let service: BookingsSettlementService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BookingsSettlementService(
      prisma as never,
      holdGateway as never,
      notifications as never,
    );
  });

  it('does not call gateway for zero rent or zero deposit', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: 'b1',
      renterId: 'r1',
      listing: { ownerId: 'o1' },
      paymentHoldId: 'hold_1',
      rentAmount: 200,
      depositAmount: 0,
      settlementStatus: BookingSettlementStatus.PENDING,
      settlementRetryCount: 0,
    });
    prisma.booking.update.mockResolvedValue({ id: 'b1' });

    await service.attemptSettlement({ bookingId: 'b1' });

    expect(holdGateway.captureRent).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 200 }),
    );
    expect(holdGateway.releaseDeposit).not.toHaveBeenCalled();
    expect(notifications.notifyRenterDepositReleased).not.toHaveBeenCalled();
    expect(notifications.notifyLandlordBookingCompleted).toHaveBeenCalled();
  });

  it('settles without gateway calls when rent and deposit are both zero', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: 'b1',
      renterId: 'r1',
      listing: { ownerId: 'o1' },
      paymentHoldId: 'hold_1',
      rentAmount: 0,
      depositAmount: 0,
      settlementStatus: BookingSettlementStatus.PENDING,
      settlementRetryCount: 0,
    });
    prisma.booking.update.mockResolvedValue({ id: 'b1' });

    await service.attemptSettlement({ bookingId: 'b1' });

    expect(holdGateway.captureRent).not.toHaveBeenCalled();
    expect(holdGateway.releaseDeposit).not.toHaveBeenCalled();
    expect(notifications.notifyRenterDepositReleased).not.toHaveBeenCalled();
    expect(notifications.notifyLandlordBookingCompleted).toHaveBeenCalled();
  });
});
