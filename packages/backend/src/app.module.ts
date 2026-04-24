import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ListingsModule } from './listings/listings.module';
import { CalendarModule } from './calendar/calendar.module';
import { SearchModule } from './search/search.module';
import { PaymentMethodsModule } from './payment-methods/payment-methods.module';
import { PaymentsHoldModule } from './payments-hold/payments-hold.module';
import { BookingsModule } from './bookings/bookings.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ScheduleModule } from '@nestjs/schedule';
import { VerificationModule } from './verification/verification.module';
import { TrustScoreModule } from './trust-score/trust-score.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    VerificationModule,
    TrustScoreModule,
    ListingsModule,
    BookingsModule,
    CalendarModule,
    SearchModule,
    PaymentMethodsModule,
    PaymentsHoldModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
