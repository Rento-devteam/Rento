import {
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, UserStatus } from '@prisma/client';
import { PaymentHoldDeclinedError } from '../payments-hold/payment-hold.gateway';
import { BookingsWorkflowService } from './bookings-workflow.service';

describe('BookingsWorkflowService', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    listing: { findUnique: jest.fn() },
    userPaymentMethod: { findFirst: jest.fn() },
    booking: { update: jest.fn() },
    $transaction: jest.fn(),
  };

  const holdGateway = { authorizeHold: jest.fn() };
  const notifications = {
    notifyRenterBookingConfirmed: jest.fn(),
    notifyLandlordNewBooking: jest.fn(),
  };

  let service: BookingsWorkflowService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BookingsWorkflowService(
      prisma as never,
      holdGateway as never,
      notifications as never,
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
    prisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        $executeRaw: jest.fn(),
        booking: {
          findFirst: jest.fn().mockResolvedValue({ id: 'b_existing' }),
          create: jest.fn(),
        },
      };
      return fn(tx);
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

    prisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        $executeRaw: jest.fn(),
        booking: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'b1', listingId: 'l1' }),
        },
      };
      return fn(tx);
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
    prisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        $executeRaw: jest.fn(),
        booking: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'b1', listingId: 'l1' }),
        },
      };
      return fn(tx);
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
});
