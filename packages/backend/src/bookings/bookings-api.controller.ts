import {
  Body,
  Controller,
  Get,
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
import { BookingsService } from './bookings.service';
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
  constructor(
    private readonly workflow: BookingsWorkflowService,
    private readonly bookings: BookingsService,
  ) {}

  @Get('bookings/as-renter')
  listAsRenter(@Req() request: RequestWithUser) {
    return this.bookings.listBookingsAsRenter(this.getUserId(request));
  }

  @Get('bookings/as-landlord')
  listAsLandlord(@Req() request: RequestWithUser) {
    return this.bookings.listBookingsAsLandlord(this.getUserId(request));
  }

  @Get('bookings/:bookingId')
  getBooking(
    @Req() request: RequestWithUser,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ) {
    return this.bookings.getBookingForParticipant(
      bookingId,
      this.getUserId(request),
    );
  }

  @Post('bookings')
  @HttpCode(HttpStatus.CREATED)
  createBooking(
    @Req() request: RequestWithUser,
    @Body() dto: CreateBookingDto,
  ) {
    return this.workflow.createBooking({
      renterId: this.getUserId(request),
      listingId: dto.listingId,
      startAtIso: dto.startAt,
      endAtIso: dto.endAt,
      cardId: dto.cardId,
      stubBalanceRub: dto.stubBalanceRub,
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
      stubBalanceRub: dto.stubBalanceRub,
    });
  }

  @Post('bookings/:bookingId/return/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmReturn(
    @Req() request: RequestWithUser,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ) {
    const userId = this.getUserId(request);
    await this.workflow.confirmReturn({ bookingId, actorUserId: userId });
    return this.bookings.getBookingForParticipant(bookingId, userId);
  }

  @Post('bookings/:bookingId/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelBooking(
    @Req() request: RequestWithUser,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ) {
    const userId = this.getUserId(request);
    await this.workflow.cancelBooking({ bookingId, actorUserId: userId });
    return this.bookings.getBookingForParticipant(bookingId, userId);
  }

  private getUserId(request: RequestWithUser): string {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user');
    }
    return userId;
  }
}
