import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { BookingsSummaryService } from './bookings-summary.service';
import { BookingDatetimeRangeDto } from './dto/booking-datetime-range.dto';

@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
  }),
)
@Controller('listings')
export class BookingsController {
  constructor(private readonly summary: BookingsSummaryService) {}

  @Get(':listingId/booking-summary')
  getBookingSummary(
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Query() query: BookingDatetimeRangeDto,
  ) {
    return this.summary.getBookingSummary(listingId, query.startAt, query.endAt);
  }
}

