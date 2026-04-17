import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentsHoldModule } from '../payments-hold/payments-hold.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BookingsController } from './bookings.controller';
import { BookingsApiController } from './bookings-api.controller';
import { BookingsSummaryService } from './bookings-summary.service';
import { BookingsService } from './bookings.service';
import { BookingsWorkflowService } from './bookings-workflow.service';

@Module({
  imports: [AuthModule, PrismaModule, PaymentsHoldModule, NotificationsModule],
  controllers: [BookingsController, BookingsApiController],
  providers: [BookingsService, BookingsSummaryService, BookingsWorkflowService],
  exports: [BookingsService],
})
export class BookingsModule {}
