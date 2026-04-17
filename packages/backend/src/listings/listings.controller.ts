import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestWithUser } from '../auth/jwt-auth.guard';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListingsService } from './listings.service';

@UseGuards(JwtAuthGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
  }),
)
@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get('create')
  getCreateMetadata(@Req() request: RequestWithUser) {
    return this.listingsService.getCreateMetadata(this.getUserId(request));
  }

  @Post()
  createListing(
    @Req() request: RequestWithUser,
    @Body() dto: CreateListingDto,
  ) {
    return this.listingsService.createListing(this.getUserId(request), dto);
  }

  private getUserId(request: RequestWithUser): string {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user');
    }

    return userId;
  }
}
