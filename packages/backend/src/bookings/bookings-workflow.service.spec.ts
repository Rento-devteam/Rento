import { ConflictException } from '@nestjs/common';
import {
  BookingSettlementStatus,
  BookingStatus,
  UserStatus,
} from '@prisma/client';
import { PaymentHoldDeclinedError } from '../payments-hold/payment-hold.gateway';
import { BookingsSettlementService } from './bookings-settlement.service';
import { BookingsWorkflowService } from './bookings-workflow.service';

describe('BookingsWorkflowService', () => {
  type Tx = {
    $executeRaw?: jest.Mock;
    booking: {
      findFirst: jest.Mock;
      create?: jest.Mock;
      update?: jest.Mock;
    };
  };

  const prisma = {
    user: { findUnique: jest.fn() },
    listing: { findUnique: jest.fn() },
    userPaymentMethod: { findFirst: jest.fn() },
    booking: { update: jest.fn() },
    $transaction: jest.fn(),
  };

  const holdGateway = {
    authorizeHold: jest.fn(),
    captureRent: jest.fn(),
    releaseDeposit: jest.fn(),
  };
  const notifications = {
    notifyRenterBookingConfirmed: jest.fn(),
    notifyLandlordNewBooking: jest.fn(),
    notifyRenterDepositReleased: jest.fn(),
    notifyLandlordBookingCompleted: jest.fn(),
  };

  let service: BookingsWorkflowService;
  let settlement: BookingsSettlementService;

  beforeEach(() => {
    jest.clearAllMocks();
    settlement = new BookingsSettlementService(
      prisma as never,
      holdGateway as never,
      notifications as never,
    );
    service = new BookingsWorkflowService(
      prisma as never,
      holdGateway as never,
      notifications as never,
      settlement as never,
    );
  });

  it('returns 409 when dates overlap', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'r1',
      status: UserStatus.ACTIVE,
    });
    prisma.listing.findUnique.mockResolvedValue({
      id: 'l1',
      ownerId: 'o1',
      rentalPrice: 100,
      rentalPeriod: 'HOUR',
      depositAmount: 50,
    });
    prisma.userPaymentMethod.findFirst.mockResolvedValue({ token: 'tok_ok' });
    prisma.$transaction.mockImplementation((fn: (tx: Tx) => unknown) => {
      const tx: Tx = {
        $executeRaw: jest.fn(),
        booking: {
          findFirst: jest.fn().mockResolvedValue({ id: 'b_existing' }),
          create: jest.fn(),
        },
      };
      return Promise.resolve(fn(tx));
    });

    await expect(
      service.createBooking({
        renterId: 'r1',
        listingId: 'l1',
        startAtIso: '2026-04-17T10:00:00.000Z',
        endAtIso: '2026-04-17T12:00:00.000Z',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('returns 402 when hold is declined', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'r1',
      status: UserStatus.ACTIVE,
    });
    prisma.listing.findUnique.mockResolvedValue({
      id: 'l1',
      ownerId: 'o1',
      rentalPrice: 100,
      rentalPeriod: 'HOUR',
      depositAmount: 50,
    });
    prisma.userPaymentMethod.findFirst.mockResolvedValue({
      token: 'tok_decline',
    });

    prisma.$transaction.mockImplementation((fn: (tx: Tx) => unknown) => {
      const tx: Tx = {
        $executeRaw: jest.fn(),
        booking: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'b1', listingId: 'l1' }),
        },
      };
      return Promise.resolve(fn(tx));
    });

    holdGateway.authorizeHold.mockRejectedValue(
      new PaymentHoldDeclinedError('declined', 'card_declined'),
    );
    prisma.booking.update.mockResolvedValue({
      id: 'b1',
      status: BookingStatus.PAYMENT_FAILED,
    });

    await expect(
      service.createBooking({
        renterId: 'r1',
        listingId: 'l1',
        startAtIso: '2026-04-17T10:00:00.000Z',
        endAtIso: '2026-04-17T12:00:00.000Z',
      }),
    ).rejects.toMatchObject({ status: 402 });
  });

  it('confirms booking and sends notifications on success', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'r1',
      status: UserStatus.ACTIVE,
    });
    prisma.listing.findUnique.mockResolvedValue({
      id: 'l1',
      ownerId: 'o1',
      rentalPrice: 100,
      rentalPeriod: 'HOUR',
      depositAmount: 50,
    });
    prisma.userPaymentMethod.findFirst.mockResolvedValue({ token: 'tok_ok' });
    prisma.$transaction.mockImplementation((fn: (tx: Tx) => unknown) => {
      const tx: Tx = {
        $executeRaw: jest.fn(),
        booking: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'b1', listingId: 'l1' }),
        },
      };
      return Promise.resolve(fn(tx));
    });
    holdGateway.authorizeHold.mockResolvedValue({
      holdId: 'hold_1',
      authorizationCode: 'auth_1',
    });
    prisma.booking.update.mockResolvedValue({
      id: 'b1',
      status: BookingStatus.CONFIRMED,
      paymentHoldId: 'hold_1',
      amountHeld: 250,
    });

    const res = await service.createBooking({
      renterId: 'r1',
      listingId: 'l1',
      startAtIso: '2026-04-17T10:00:00.000Z',
      endAtIso: '2026-04-17T12:00:00.000Z',
    });

    expect(res).toEqual({ bookingId: 'b1', status: BookingStatus.CONFIRMED });
    expect(notifications.notifyRenterBookingConfirmed).toHaveBeenCalledWith({
      bookingId: 'b1',
      renterId: 'r1',
    });
    expect(notifications.notifyLandlordNewBooking).toHaveBeenCalledWith({
      bookingId: 'b1',
      landlordId: 'o1',
    });
  });

  it('completes booking and runs settlement when renter and landlord confirm return', async () => {
    const bookingRow = {
      id: 'b1',
      status: BookingStatus.ACTIVE,
      renterId: 'r1',
      listingId: 'l1',
      listing: { ownerId: 'o1' },
      rentAmount: 200,
      depositAmount: 100,
      paymentHoldId: 'hold_1',
      returnRenterConfirmedAt: null,
      returnLandlordConfirmedAt: null,
      returnMutualConfirmedAt: null,
      returnConfirmationDeadlineAt: null,
      settlementStatus: BookingSettlementStatus.NONE,
    };

    prisma.$transaction.mockImplementation((fn: (tx: Tx) => unknown) => {
      const tx: Tx = {
        booking: {
          findFirst: jest.fn().mockResolvedValue(bookingRow),
          update: jest.fn().mockResolvedValue({
            id: 'b1',
            paymentHoldId: 'hold_1',
            rentAmount: 200,
            depositAmount: 100,
            settlementStatus: BookingSettlementStatus.PENDING,
          }),
        },
      };
      return Promise.resolve(fn(tx));
    });

    holdGateway.captureRent.mockResolvedValue({ operationId: 'cap_1' });
    holdGateway.releaseDeposit.mockResolvedValue({ operationId: 'rel_1' });
    prisma.booking.update.mockResolvedValue({ id: 'b1' });
    prisma.booking.findUnique = jest.fn().mockResolvedValue({
      id: 'b1',
      renterId: 'r1',
      listing: { ownerId: 'o1' },
      paymentHoldId: 'hold_1',
      rentAmount: 200,
      depositAmount: 100,
      settlementStatus: BookingSettlementStatus.PENDING,
      settlementRetryCount: 0,
    });

    await service.confirmReturn({ bookingId: 'b1', actorUserId: 'r1' });

    // second call as landlord triggers mutual confirm + settlement
    bookingRow.returnRenterConfirmedAt = new Date('2026-04-23T10:00:00.000Z');
    prisma.$transaction.mockImplementationOnce((fn: (tx: Tx) => unknown) => {
      const tx: Tx = {
        booking: {
          findFirst: jest.fn().mockResolvedValue(bookingRow),
          update: jest.fn().mockResolvedValue({
            id: 'b1',
            paymentHoldId: 'hold_1',
            rentAmount: 200,
            depositAmount: 100,
            settlementStatus: BookingSettlementStatus.PENDING,
          }),
        },
      };
      return Promise.resolve(fn(tx));
    });

    await service.confirmReturn({ bookingId: 'b1', actorUserId: 'o1' });

    expect(holdGateway.captureRent).toHaveBeenCalled();
    expect(holdGateway.releaseDeposit).toHaveBeenCalled();
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'b1' },
        data: expect.objectContaining({
          settlementStatus: BookingSettlementStatus.SETTLED,
        }) as unknown,
      }),
    );
    expect(notifications.notifyRenterDepositReleased).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: 'b1', renterId: 'r1', amount: 100 }),
    );
  });
});
