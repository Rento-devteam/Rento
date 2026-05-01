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
import { ListingStatus, Prisma, RentalPeriod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { UploadListingPhotoDto } from './dto/upload-listing-photo.dto';
import {
  LISTING_PHOTO_ALLOWED_MIME_TYPES,
  MAX_LISTING_PHOTOS,
} from './listing.constants';
import {
  mapCategory,
  mapListingCreatedResponse,
  mapListingDetail,
  mapListingPhotoUploadResponse,
  mapListingPhotosResponse,
  mapListingPublishResponse,
} from './listing.mapper';
import { ListingPhotoStorage } from './listing-photo-storage.service';
import { ListingSearchIndexService } from '../search/listing-search-index.service';
import { CALENDAR_BLOCKING_BOOKING_STATUSES } from '../bookings/bookings.constants';

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

  async getMyListings(userId: string) {
    const listings = await this.prismaService.listing.findMany({
      where: { ownerId: userId },
      include: {
        category: true,
        photos: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return listings.map(mapListingDetail);
  }

  async getPublicListingsByOwner(ownerId: string) {
    const listings = await this.prismaService.listing.findMany({
      where: { ownerId, status: ListingStatus.ACTIVE },
      include: {
        category: true,
        photos: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 24,
    });
    return listings.map(mapListingDetail);
  }

  async getListingById(listingId: string) {
    const listing = await this.prismaService.listing.findUnique({
      where: { id: listingId },
      include: {
        category: true,
        photos: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.status === ListingStatus.DRAFT) {
      throw new NotFoundException('Listing not found');
    }

    return mapListingDetail(listing);
  }

  async getOwnedListing(userId: string, listingId: string) {
    const listing = await this.prismaService.listing.findFirst({
      where: { id: listingId, ownerId: userId },
      include: {
        category: true,
        photos: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    return mapListingDetail(listing);
  }

  async updateOwnedListing(
    userId: string,
    listingId: string,
    dto: UpdateListingDto,
  ) {
    const listing = await this.prismaService.listing.findFirst({
      where: { id: listingId, ownerId: userId },
      select: { id: true, status: true },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (
      listing.status !== ListingStatus.DRAFT &&
      listing.status !== ListingStatus.ACTIVE
    ) {
      throw new ConflictException('Это объявление нельзя редактировать');
    }

    const definedKeys = (
      Object.keys(dto) as Array<keyof UpdateListingDto>
    ).filter((k) => dto[k] !== undefined);
    if (definedKeys.length === 0) {
      throw new BadRequestException('Нет данных для обновления');
    }

    if (dto.categoryId !== undefined) {
      const category = await this.prismaService.category.findFirst({
        where: { id: dto.categoryId, isActive: true },
      });
      if (!category) {
        throw new UnprocessableEntityException('Категория недоступна');
      }
    }

    const data: Prisma.ListingUpdateInput = {};
    if (dto.categoryId !== undefined) {
      data.category = { connect: { id: dto.categoryId } };
    }
    if (dto.title !== undefined) {
      const t = dto.title.trim();
      if (!t) {
        throw new UnprocessableEntityException('Укажите название');
      }
      data.title = t;
    }
    if (dto.description !== undefined) {
      data.description = dto.description.trim();
    }
    if (dto.rentalPrice !== undefined) {
      data.rentalPrice = dto.rentalPrice;
    }
    if (dto.rentalPeriod !== undefined) {
      data.rentalPeriod = dto.rentalPeriod;
    }
    if (dto.depositAmount !== undefined) {
      data.depositAmount = dto.depositAmount;
    }
    if (dto.latitude !== undefined) {
      data.latitude = dto.latitude;
    }
    if (dto.longitude !== undefined) {
      data.longitude = dto.longitude;
    }
    if (dto.addressText !== undefined) {
      const a = dto.addressText.trim();
      data.addressText = a.length > 0 ? a : null;
    }

    const updated = await this.prismaService.listing.update({
      where: { id: listingId },
      data,
      include: {
        category: true,
        photos: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (updated.status === ListingStatus.ACTIVE) {
      try {
        await this.listingSearchIndex.indexListing(listingId);
      } catch (err) {
        this.logger.warn(
          `Failed to index listing ${listingId} in Elasticsearch: ${String(err)}`,
        );
      }
    }

    return mapListingDetail(updated);
  }

  async deleteListing(userId: string, listingId: string) {
    const listing = await this.prismaService.listing.findUnique({
      where: { id: listingId },
      select: { id: true, ownerId: true },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.ownerId !== userId) {
      throw new ForbiddenException('You can only delete your own listings');
    }

    const blockingBookings = await this.prismaService.booking.count({
      where: {
        listingId,
        status: { in: CALENDAR_BLOCKING_BOOKING_STATUSES },
      },
    });
    if (blockingBookings > 0) {
      throw new ConflictException(
        'Нельзя удалить объявление: есть активные или ожидающие бронирования. Отмените сделки или дождитесь их завершения.',
      );
    }

    await this.prismaService.listingPhoto.deleteMany({ where: { listingId } });
    await this.prismaService.listingManualCalendarBlock.deleteMany({
      where: { listingId },
    });
    await this.prismaService.listing.delete({ where: { id: listingId } });

    try {
      await this.listingSearchIndex.removeListing(listingId);
    } catch {
      // Search index is best-effort; ignore failures on delete.
    }

    return { success: true };
  }

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
        minDeposit: 0,
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
    const description = dto.description?.trim() ?? '';
    if (!title) {
      throw new UnprocessableEntityException('Title is required');
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
        ...(dto.addressText !== undefined
          ? {
              addressText:
                dto.addressText.trim().length > 0
                  ? dto.addressText.trim()
                  : null,
            }
          : {}),
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

    if (
      listing.status !== ListingStatus.DRAFT &&
      listing.status !== ListingStatus.ACTIVE
    ) {
      throw new ConflictException(
        'Photos can only be uploaded for draft or active listings',
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

    const response = mapListingPhotoUploadResponse(
      createdPhoto,
      listing.photos.length + 1,
    );

    if (listing.status === ListingStatus.ACTIVE) {
      try {
        await this.listingSearchIndex.indexListing(listingId);
      } catch (err) {
        this.logger.warn(
          `Failed to index listing ${listingId} in Elasticsearch: ${String(err)}`,
        );
      }
    }

    return response;
  }

  async deleteListingPhoto(userId: string, listingId: string, photoId: string) {
    const listing = await this.prismaService.listing.findFirst({
      where: { id: listingId, ownerId: userId },
      select: {
        id: true,
        status: true,
        photos: {
          orderBy: { order: 'asc' },
          select: { id: true, order: true, isPrimary: true },
        },
      },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (
      listing.status !== ListingStatus.DRAFT &&
      listing.status !== ListingStatus.ACTIVE
    ) {
      throw new ConflictException(
        'Photos can only be managed for draft or active listings',
      );
    }

    const photo = listing.photos.find((p) => p.id === photoId);
    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    if (listing.status === ListingStatus.ACTIVE && listing.photos.length <= 1) {
      throw new BadRequestException(
        'У опубликованного объявления должно остаться хотя бы одно фото',
      );
    }

    const wasPrimary = photo.isPrimary;

    await this.prismaService.listingPhoto.delete({
      where: { id: photoId },
    });

    const remaining = await this.prismaService.listingPhoto.findMany({
      where: { listingId },
      orderBy: { order: 'asc' },
    });

    if (wasPrimary && remaining.length > 0) {
      await this.prismaService.listingPhoto.updateMany({
        where: { listingId },
        data: { isPrimary: false },
      });
      await this.prismaService.listingPhoto.update({
        where: { id: remaining[0].id },
        data: { isPrimary: true },
      });
    }

    if (listing.status === ListingStatus.ACTIVE) {
      try {
        await this.listingSearchIndex.indexListing(listingId);
      } catch (err) {
        this.logger.warn(
          `Failed to index listing ${listingId} in Elasticsearch: ${String(err)}`,
        );
      }
    }

    return {
      success: true,
      totalPhotos: remaining.length,
      message: 'Photo removed',
    };
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
