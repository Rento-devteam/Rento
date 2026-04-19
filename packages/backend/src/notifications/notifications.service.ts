import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  async notifyRenterBookingConfirmed(params: {
    bookingId: string;
    renterId: string;
  }) {
    this.logger.log(
      { ...params, type: 'renter_booking_confirmed' },
      'Notification stub',
    );
  }

  async notifyLandlordNewBooking(params: {
    bookingId: string;
    landlordId: string;
  }) {
    this.logger.log(
      { ...params, type: 'landlord_new_booking' },
      'Notification stub',
    );
  }
}
