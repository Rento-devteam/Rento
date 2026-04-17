import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestWithUser } from '../auth/jwt-auth.guard';
import { CreateBookingDto } from './dto/create-booking.dto';
import { RetryBookingPaymentDto } from './dto/retry-booking-payment.dto';
import { BookingsWorkflowService } from './bookings-workflow.service';

@UseGuards(JwtAuthGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
  }),
)
@Controller()
export class BookingsApiController {
  constructor(private readonly workflow: BookingsWorkflowService) {}

  @Post('bookings')
  @HttpCode(HttpStatus.CREATED)
  createBooking(@Req() request: RequestWithUser, @Body() dto: CreateBookingDto) {
    return this.workflow.createBooking({
      renterId: this.getUserId(request),
      listingId: dto.listingId,
      startAtIso: dto.startAt,
      endAtIso: dto.endAt,
      cardId: dto.cardId,
    });
  }

  @Post('bookings/:bookingId/retry-payment')
  @HttpCode(HttpStatus.OK)
  retryPayment(
    @Req() request: RequestWithUser,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: RetryBookingPaymentDto,
  ) {
    return this.workflow.retryPayment({
      renterId: this.getUserId(request),
      bookingId,
      cardId: dto.cardId,
    });
  }

  private getUserId(request: RequestWithUser): string {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user');
    }
    return userId;
  }
}

