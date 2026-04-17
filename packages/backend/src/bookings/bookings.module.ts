import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BookingsService } from './bookings.service';

@Module({
  imports: [PrismaModule],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
