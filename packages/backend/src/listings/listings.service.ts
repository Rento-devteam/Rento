import {
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ListingStatus, RentalPeriod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateListingDto } from './dto/create-listing.dto';
import {
  mapCategory,
  mapListingCreatedResponse,
} from './listing.mapper';

const MAX_LISTING_PHOTOS = 10;

@Injectable()
export class ListingsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly usersService: UsersService,
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
}
