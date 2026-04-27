import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { createValidationExceptionFactory } from '../validation/validation-exception.factory';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
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
    exceptionFactory: createValidationExceptionFactory(),
  }),
)
@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  /** Static paths must be registered before `:listingId` or Nest matches "my"/"create" as UUID params. */
  @UseGuards(JwtAuthGuard)
  @Get('create')
  getCreateMetadata(@Req() request: RequestWithUser) {
    return this.listingsService.getCreateMetadata(this.getUserId(request));
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  getMyListings(@Req() request: RequestWithUser) {
    return this.listingsService.getMyListings(this.getUserId(request));
  }

  @UseGuards(JwtAuthGuard)
  @Get('owned/:listingId')
  getOwnedListing(
    @Req() request: RequestWithUser,
    @Param('listingId', ParseUUIDPipe) listingId: string,
  ) {
    return this.listingsService.getOwnedListing(
      this.getUserId(request),
      listingId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch('owned/:listingId')
  @HttpCode(HttpStatus.OK)
  updateOwnedListing(
    @Req() request: RequestWithUser,
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Body() dto: UpdateListingDto,
  ) {
    return this.listingsService.updateOwnedListing(
      this.getUserId(request),
      listingId,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  createListing(
    @Req() request: RequestWithUser,
    @Body() dto: CreateListingDto,
  ) {
    return this.listingsService.createListing(this.getUserId(request), dto);
  }

  @Get(':listingId')
  getListingById(@Param('listingId', ParseUUIDPipe) listingId: string) {
    return this.listingsService.getListingById(listingId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':listingId')
  @HttpCode(HttpStatus.OK)
  deleteListing(
    @Req() request: RequestWithUser,
    @Param('listingId', ParseUUIDPipe) listingId: string,
  ) {
    return this.listingsService.deleteListing(
      this.getUserId(request),
      listingId,
    );
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
  @Delete(':listingId/photos/:photoId')
  @HttpCode(HttpStatus.OK)
  deleteListingPhoto(
    @Req() request: RequestWithUser,
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ) {
    return this.listingsService.deleteListingPhoto(
      this.getUserId(request),
      listingId,
      photoId,
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
