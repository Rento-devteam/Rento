import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  BookingSettlementStatus,
  BookingStatus,
  UserStatus,
} from '@prisma/client';
import { PaymentHoldDeclinedError } from '../payments-hold/payment-hold.gateway';
import { BookingsSettlementService } from './bookings-settlement.service';
import { BookingsWorkflowService } from './bookings-workflow.service';

function sampleFutureHourBooking(): { startAtIso: string; endAtIso: string } {
  const start = new Date(Date.now() + 86_400_000);
  start.setUTCMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  return { startAtIso: start.toISOString(), endAtIso: end.toISOString() };
}

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
    booking: {
      findFirst: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
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

  const trustScoreService = {
    recalculateForUser: jest.fn(),
  };

  let service: BookingsWorkflowService;
  let settlement: BookingsSettlementService;

  beforeEach(() => {
    jest.clearAllMocks();
    settlement = new BookingsSettlementService(
      prisma as never,
      holdGateway,
      notifications as never,
    );
    service = new BookingsWorkflowService(
      prisma as never,
      holdGateway,
      notifications as never,
      settlement,
      trustScoreService as never,
    );
  });

  it('rejects booking when start is in the past', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'r1',
      status: UserStatus.ACTIVE,
    });
    prisma.listing.findUnique.mockResolvedValue({
      id: 'l1',
      ownerId: 'o1',
      rentalPrice: 100,
      rentalPeriod: 'DAY',
      depositAmount: 50,
    });
    const past = new Date(Date.now() - 7 * 86_400_000);
    const end = new Date(past.getTime() + 86_400_000);

    await expect(
      service.createBooking({
        renterId: 'r1',
        listingId: 'l1',
        startAtIso: past.toISOString(),
        endAtIso: end.toISOString(),
      }),
    ).rejects.toThrow(BadRequestException);
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

    const { startAtIso, endAtIso } = sampleFutureHourBooking();
    await expect(
      service.createBooking({
        renterId: 'r1',
        listingId: 'l1',
        startAtIso,
        endAtIso,
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

    const { startAtIso, endAtIso } = sampleFutureHourBooking();
    await expect(
      service.createBooking({
        renterId: 'r1',
        listingId: 'l1',
        startAtIso,
        endAtIso,
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

    const { startAtIso, endAtIso } = sampleFutureHourBooking();
    const res = await service.createBooking({
      renterId: 'r1',
      listingId: 'l1',
      startAtIso,
      endAtIso,
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
    const bookingRow: any = {
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
    prisma.booking.findUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'b1',
        renterId: 'r1',
        listing: { ownerId: 'o1' },
        paymentHoldId: 'hold_1',
        rentAmount: 200,
        depositAmount: 100,
        settlementStatus: BookingSettlementStatus.PENDING,
        settlementRetryCount: 0,
      })
      .mockResolvedValueOnce({
        settlementStatus: BookingSettlementStatus.SETTLED,
        renterId: 'r1',
        listing: { ownerId: 'o1' },
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
    expect(trustScoreService.recalculateForUser).toHaveBeenCalledWith({
      userId: 'r1',
      eventType: 'booking_completed',
    });
    expect(trustScoreService.recalculateForUser).toHaveBeenCalledWith({
      userId: 'o1',
      eventType: 'booking_completed',
    });
  });

  it('retries settlement when booking is already COMPLETED and settlement failed', async () => {
    const bookingRow: any = {
      id: 'b1',
      status: BookingStatus.COMPLETED,
      renterId: 'r1',
      listingId: 'l1',
      listing: { ownerId: 'o1' },
      rentAmount: 200,
      depositAmount: 100,
      paymentHoldId: 'hold_1',
      returnRenterConfirmedAt: new Date('2026-04-23T09:00:00.000Z'),
      returnLandlordConfirmedAt: new Date('2026-04-23T09:30:00.000Z'),
      returnMutualConfirmedAt: new Date('2026-04-23T10:00:00.000Z'),
      returnConfirmationDeadlineAt: null,
      settlementStatus: BookingSettlementStatus.FAILED,
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
    prisma.booking.findUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'b1',
        renterId: 'r1',
        listing: { ownerId: 'o1' },
        paymentHoldId: 'hold_1',
        rentAmount: 200,
        depositAmount: 100,
        settlementStatus: BookingSettlementStatus.PENDING,
        settlementRetryCount: 0,
      })
      .mockResolvedValueOnce({
        settlementStatus: BookingSettlementStatus.SETTLED,
        renterId: 'r1',
        listing: { ownerId: 'o1' },
      });

    await service.confirmReturn({ bookingId: 'b1', actorUserId: 'r1' });

    expect(holdGateway.captureRent).toHaveBeenCalled();
    expect(holdGateway.releaseDeposit).toHaveBeenCalled();
    expect(trustScoreService.recalculateForUser).toHaveBeenCalledWith({
      userId: 'r1',
      eventType: 'booking_completed',
    });
    expect(trustScoreService.recalculateForUser).toHaveBeenCalledWith({
      userId: 'o1',
      eventType: 'booking_completed',
    });
  });

  it('cancels PAYMENT_FAILED booking without calling payment gateway', async () => {
    prisma.booking.findFirst.mockResolvedValue({
      id: 'b1',
      status: BookingStatus.PAYMENT_FAILED,
      renterId: 'r1',
      totalAmount: 150,
      amountHeld: null,
      paymentHoldId: null,
    });
    prisma.booking.update.mockResolvedValue({ id: 'b1' });

    await service.cancelBooking({ bookingId: 'b1', actorUserId: 'r1' });

    expect(holdGateway.releaseDeposit).not.toHaveBeenCalled();
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'b1' },
        data: expect.objectContaining({ status: BookingStatus.CANCELLED }),
      }),
    );
  });

  it('cancels CONFIRMED booking and releases hold', async () => {
    prisma.booking.findFirst.mockResolvedValue({
      id: 'b1',
      status: BookingStatus.CONFIRMED,
      renterId: 'r1',
      totalAmount: 300,
      amountHeld: 300,
      paymentHoldId: 'hold_1',
    });
    holdGateway.releaseDeposit.mockResolvedValue({ operationId: 'rel_cancel' });
    prisma.booking.update.mockResolvedValue({ id: 'b1' });

    await service.cancelBooking({ bookingId: 'b1', actorUserId: 'r1' });

    expect(holdGateway.releaseDeposit).toHaveBeenCalledWith(
      expect.objectContaining({
        holdId: 'hold_1',
        amount: 300,
        idempotencyKey: 'booking_cancel_release:b1',
      }),
    );
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'b1' },
        data: expect.objectContaining({ status: BookingStatus.CANCELLED }),
      }),
    );
  });

  it('rejects cancel when booking is completed', async () => {
    prisma.booking.findFirst.mockResolvedValue({
      id: 'b1',
      status: BookingStatus.COMPLETED,
      renterId: 'r1',
      totalAmount: 100,
      amountHeld: null,
      paymentHoldId: null,
    });

    await expect(
      service.cancelBooking({ bookingId: 'b1', actorUserId: 'r1' }),
    ).rejects.toThrow(ConflictException);
    expect(holdGateway.releaseDeposit).not.toHaveBeenCalled();
  });
});
