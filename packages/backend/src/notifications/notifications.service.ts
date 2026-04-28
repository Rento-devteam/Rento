import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  notifyRenterBookingConfirmed(params: {
    bookingId: string;
    renterId: string;
  }) {
    this.logger.log(
      { ...params, type: 'renter_booking_confirmed' },
      'Notification stub',
    );
    return Promise.resolve();
  }

  notifyLandlordNewBooking(params: { bookingId: string; landlordId: string }) {
    this.logger.log(
      { ...params, type: 'landlord_new_booking' },
      'Notification stub',
    );
    return Promise.resolve();
  }

  notifyLandlordAutoReturnDeadlineExpired(params: {
    bookingId: string;
    landlordId: string;
  }) {
    this.logger.log(
      { ...params, type: 'landlord_auto_return_deadline_expired' },
      'Notification stub',
    );
    return Promise.resolve();
  }

  notifyRenterDepositReleased(params: {
    bookingId: string;
    renterId: string;
    amount: number;
  }) {
    this.logger.log(
      { ...params, type: 'renter_deposit_released' },
      'Notification stub',
    );
    return Promise.resolve();
  }

  notifyLandlordBookingCompleted(params: {
    bookingId: string;
    landlordId: string;
  }) {
    this.logger.log(
      { ...params, type: 'landlord_booking_completed' },
      'Notification stub',
    );
    return Promise.resolve();
  }
}
