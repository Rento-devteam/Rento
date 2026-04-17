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
  UploadedFile,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestWithUser } from '../auth/jwt-auth.guard';
import { CreateListingDto } from './dto/create-listing.dto';
import { UploadListingPhotoDto } from './dto/upload-listing-photo.dto';
import {
  MAX_LISTING_PHOTO_BYTES,
  MAX_LISTING_PHOTOS,
} from './listing.constants';
import { ListingsService } from './listings.service';

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

  @UseGuards(JwtAuthGuard)
  @Get('create')
  getCreateMetadata(@Req() request: RequestWithUser) {
    return this.listingsService.getCreateMetadata(this.getUserId(request));
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  createListing(
    @Req() request: RequestWithUser,
    @Body() dto: CreateListingDto,
  ) {
    return this.listingsService.createListing(this.getUserId(request), dto);
  }

  @Get(':listingId/photos')
  listPhotos(@Param('listingId', ParseUUIDPipe) listingId: string) {
    return this.listingsService.listPhotos(listingId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':listingId/photos')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: MAX_LISTING_PHOTO_BYTES,
        files: MAX_LISTING_PHOTOS,
      },
    }),
  )
  uploadPhoto(
    @Req() request: RequestWithUser,
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadListingPhotoDto,
  ) {
    return this.listingsService.uploadPhoto(
      this.getUserId(request),
      listingId,
      dto,
      file,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':listingId/publish')
  @HttpCode(HttpStatus.OK)
  publishListing(
    @Req() request: RequestWithUser,
    @Param('listingId', ParseUUIDPipe) listingId: string,
  ) {
    return this.listingsService.publishListing(
      this.getUserId(request),
      listingId,
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
