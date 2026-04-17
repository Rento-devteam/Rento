import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ListingStatus, RentalPeriod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UploadListingPhotoDto } from './dto/upload-listing-photo.dto';
import {
  LISTING_PHOTO_ALLOWED_MIME_TYPES,
  MAX_LISTING_PHOTOS,
} from './listing.constants';
import {
  mapCategory,
  mapListingCreatedResponse,
  mapListingPhotoUploadResponse,
  mapListingPhotosResponse,
  mapListingPublishResponse,
} from './listing.mapper';
import { ListingPhotoStorage } from './listing-photo-storage.service';
import { ListingSearchIndexService } from '../search/listing-search-index.service';

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly usersService: UsersService,
    @Inject(ListingPhotoStorage)
    private readonly listingPhotoStorage: ListingPhotoStorage,
    private readonly listingSearchIndex: ListingSearchIndexService,
  ) {}

  async getCreateMetadata(userId: string) {
    await this.usersService.assertUserCanCreateListing(userId);

    const categories = await this.prismaService.category.findMany({
      where: { isActive: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });

    return {
      categories: categories.map(mapCategory),
      priceRules: {
        currency: 'RUB',
        supportedPeriods: Object.values(RentalPeriod),
        minPrice: 0.01,
        minDeposit: 0.01,
      },
      limits: {
        maxPhotos: MAX_LISTING_PHOTOS,
      },
    };
  }

  async createListing(userId: string, dto: CreateListingDto) {
    await this.usersService.assertUserCanCreateListing(userId);

    const category = await this.prismaService.category.findFirst({
      where: { id: dto.categoryId, isActive: true },
    });
    if (!category) {
      throw new UnprocessableEntityException('Category is invalid or inactive');
    }

    const title = dto.title.trim();
    const description = dto.description.trim();
    if (!title || !description) {
      throw new UnprocessableEntityException(
        'Title and description are required',
      );
    }

    const listing = await this.prismaService.listing.create({
      data: {
        ownerId: userId,
        categoryId: dto.categoryId,
        title,
        description,
        rentalPrice: dto.rentalPrice,
        rentalPeriod: dto.rentalPeriod,
        depositAmount: dto.depositAmount,
        status: ListingStatus.DRAFT,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
      },
      include: {
        category: true,
        photos: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return mapListingCreatedResponse(listing);
  }

  async listPhotos(listingId: string) {
    const listing = await this.prismaService.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        photos: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    return mapListingPhotosResponse(listing.photos);
  }

  async uploadPhoto(
    userId: string,
    listingId: string,
    dto: UploadListingPhotoDto,
    file: Express.Multer.File | undefined,
  ) {
    this.assertListingPhotoFile(file);

    const listing = await this.prismaService.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        ownerId: true,
        status: true,
        photos: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.ownerId !== userId) {
      throw new ForbiddenException(
        'You can only manage your own listing photos',
      );
    }

    if (listing.status !== ListingStatus.DRAFT) {
      throw new ConflictException(
        'Photos can only be uploaded for draft listings',
      );
    }

    if (listing.photos.length >= MAX_LISTING_PHOTOS) {
      throw new BadRequestException('Photo limit reached');
    }

    const order = this.resolvePhotoOrder(listing.photos, dto.order);
    const shouldBePrimary =
      listing.photos.length === 0 || dto.isPrimary === true;
    const uploadedPhoto = await this.listingPhotoStorage.uploadListingPhoto({
      listingId,
      originalFileName: file.originalname,
      contentType: file.mimetype,
      content: file.buffer,
    });

    if (shouldBePrimary) {
      await this.prismaService.listingPhoto.updateMany({
        where: { listingId },
        data: { isPrimary: false },
      });
    }

    const createdPhoto = await this.prismaService.listingPhoto.create({
      data: {
        listingId,
        url: uploadedPhoto.url,
        thumbnailUrl: uploadedPhoto.thumbnailUrl,
        order,
        isPrimary: shouldBePrimary,
      },
    });

    return mapListingPhotoUploadResponse(
      createdPhoto,
      listing.photos.length + 1,
    );
  }

  async publishListing(userId: string, listingId: string) {
    const listing = await this.prismaService.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        ownerId: true,
        status: true,
        photos: {
          select: { id: true },
        },
      },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.ownerId !== userId) {
      throw new ForbiddenException('You can only publish your own listings');
    }

    if (listing.status !== ListingStatus.DRAFT) {
      throw new ConflictException('Only draft listings can be published');
    }

    if (listing.photos.length === 0) {
      throw new BadRequestException(
        'At least one photo is required before publishing',
      );
    }

    const updatedListing = await this.prismaService.listing.update({
      where: { id: listingId },
      data: {
        status: ListingStatus.ACTIVE,
      },
      select: {
        id: true,
        status: true,
      },
    });

    try {
      await this.listingSearchIndex.indexListing(listingId);
    } catch (err) {
      this.logger.warn(
        `Failed to index listing ${listingId} in Elasticsearch: ${String(err)}`,
      );
    }

    return mapListingPublishResponse(updatedListing);
  }

  private assertListingPhotoFile(
    file: Express.Multer.File | undefined,
  ): asserts file is Express.Multer.File {
    if (!file) {
      throw new BadRequestException('Photo file is required');
    }

    if (!LISTING_PHOTO_ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        'Only JPEG, PNG, and WebP photos are supported',
      );
    }
  }

  private resolvePhotoOrder(
    photos: Array<{ order: number }>,
    requestedOrder: number | undefined,
  ) {
    if (requestedOrder === undefined) {
      if (photos.length === 0) {
        return 0;
      }

      return Math.max(...photos.map((photo) => photo.order)) + 1;
    }

    if (photos.some((photo) => photo.order === requestedOrder)) {
      throw new ConflictException('Photo order is already used');
    }

    return requestedOrder;
  }
}
