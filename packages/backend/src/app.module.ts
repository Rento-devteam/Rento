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

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
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
