import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestWithUser } from '../auth/jwt-auth.guard';
import { CalendarService } from './calendar.service';
import { CalendarBlockDto } from './dto/calendar-block.dto';
import { DateRangeQueryDto } from './dto/date-range-query.dto';
import { UnblockCalendarQueryDto } from './dto/unblock-calendar-query.dto';

@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
  }),
)
@Controller('listings')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get(':listingId/calendar')
  getCalendar(
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    return this.calendarService.getCalendar(listingId, start, end);
  }

  @Get(':listingId/dates/availability')
  checkAvailability(
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Query() query: DateRangeQueryDto,
  ) {
    return this.calendarService.checkRangeAvailability(
      listingId,
      query.start,
      query.end,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':listingId/calendar/block')
  @HttpCode(HttpStatus.OK)
  blockDates(
    @Req() request: RequestWithUser,
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Body() body: CalendarBlockDto,
  ) {
    return this.calendarService.blockDates(
      this.getUserId(request),
      listingId,
      body.startDate,
      body.endDate,
      body.reason,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':listingId/calendar/block')
  @HttpCode(HttpStatus.OK)
  unblockDates(
    @Req() request: RequestWithUser,
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Query() query: UnblockCalendarQueryDto,
  ) {
    return this.calendarService.unblockDates(
      this.getUserId(request),
      listingId,
      query.start,
      query.end,
      query.force,
      query.cancelBookings,
    );
  }

  private getUserId(request: RequestWithUser): string {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user');
    }
    return userId;
  }
}
