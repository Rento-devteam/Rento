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
}
