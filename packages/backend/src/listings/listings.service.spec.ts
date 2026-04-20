import {
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ListingStatus, RentalPeriod } from '@prisma/client';
import { ListingsService } from './listings.service';

describe('ListingsService', () => {
  const usersService = {
    assertUserCanCreateListing: jest.fn(async () => undefined),
  };

  const listingPhotoStorage = {
    uploadListingPhoto: jest.fn(),
  };

  const listingSearchIndex = {
    indexListing: jest.fn(async () => undefined),
  };

  const prismaService = {
    category: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    listing: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    listingPhoto: {
      updateMany: jest.fn(),
      create: jest.fn(),
    },
  };

  let service: ListingsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ListingsService(
      prismaService as never,
      usersService as never,
      listingPhotoStorage as never,
      listingSearchIndex as never,
    );
  });

  it('returns create metadata with categories and limits', async () => {
    prismaService.category.findMany.mockResolvedValue([
      {
        id: 'category-1',
        name: 'Tools',
        slug: 'tools',
        icon: null,
        order: 1,
        isActive: true,
      },
    ]);

    const result = await service.getCreateMetadata('user-1');

    expect(usersService.assertUserCanCreateListing).toHaveBeenCalledWith(
      'user-1',
    );
    expect(result.categories).toHaveLength(1);
    expect(result.priceRules.supportedPeriods).toEqual(
      Object.values(RentalPeriod),
    );
    expect(result.limits.maxPhotos).toBe(10);
  });

  it('creates a listing draft and returns next step', async () => {
    prismaService.category.findFirst.mockResolvedValue({
      id: 'category-1',
      name: 'Tools',
      slug: 'tools',
      icon: null,
      order: 1,
      isActive: true,
    });
    prismaService.listing.create.mockResolvedValue({
      id: 'listing-1',
      ownerId: 'user-1',
      categoryId: 'category-1',
      title: 'Drill',
      description: 'Power drill',
      rentalPrice: 150,
      rentalPeriod: RentalPeriod.DAY,
      depositAmount: 500,
      status: ListingStatus.DRAFT,
      latitude: null,
      longitude: null,
      category: {
        id: 'category-1',
        name: 'Tools',
        slug: 'tools',
        icon: null,
        order: 1,
        isActive: true,
      },
      photos: [],
      createdAt: new Date('2026-04-17T00:00:00.000Z'),
      updatedAt: new Date('2026-04-17T00:00:00.000Z'),
    });

    const result = await service.createListing('user-1', {
      categoryId: 'category-1',
      title: '  Drill  ',
      description: '  Power drill  ',
      rentalPrice: 150,
      rentalPeriod: RentalPeriod.DAY,
      depositAmount: 500,
    });

    expect(prismaService.listing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerId: 'user-1',
          title: 'Drill',
          description: 'Power drill',
          rentalPrice: 150,
          rentalPeriod: RentalPeriod.DAY,
          depositAmount: 500,
          status: ListingStatus.DRAFT,
        }),
      }),
    );
    expect(result.status).toBe(ListingStatus.DRAFT);
    expect(result.nextStep).toBe('upload_photos');
    expect(result.message).toBe(
      'Draft created. Upload at least one photo to continue.',
    );
  });

  it('rejects inactive or missing categories', async () => {
    prismaService.category.findFirst.mockResolvedValue(null);

    await expect(
      service.createListing('user-1', {
        categoryId: 'missing-category',
        title: 'Drill',
        description: 'Power drill',
        rentalPrice: 150,
        rentalPeriod: RentalPeriod.DAY,
        depositAmount: 500,
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('uploads a first photo and returns publish as next step', async () => {
    prismaService.listing.findUnique.mockResolvedValue({
      id: 'listing-1',
      ownerId: 'user-1',
      status: ListingStatus.DRAFT,
      photos: [],
    });
    listingPhotoStorage.uploadListingPhoto.mockResolvedValue({
      url: 'https://cdn.example.com/listings/listing-1/photo-1.png',
      thumbnailUrl: null,
    });
    prismaService.listingPhoto.updateMany.mockResolvedValue({ count: 0 });
    prismaService.listingPhoto.create.mockResolvedValue({
      id: 'photo-1',
      listingId: 'listing-1',
      url: 'https://cdn.example.com/listings/listing-1/photo-1.png',
      thumbnailUrl: null,
      order: 0,
      isPrimary: true,
      uploadedAt: new Date('2026-04-17T12:00:00.000Z'),
    });

    const result = await service.uploadPhoto('user-1', 'listing-1', {}, {
      originalname: 'photo.png',
      mimetype: 'image/png',
      buffer: Buffer.from('image'),
    } as Express.Multer.File);

    expect(listingPhotoStorage.uploadListingPhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        listingId: 'listing-1',
        originalFileName: 'photo.png',
        contentType: 'image/png',
      }),
    );
    expect(prismaService.listingPhoto.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        listingId: 'listing-1',
        order: 0,
        isPrimary: true,
      }),
    });
    expect(result.nextStep).toBe('publish_listing');
    expect(result.totalPhotos).toBe(1);
  });

  it('rejects photo upload when the limit is reached', async () => {
    prismaService.listing.findUnique.mockResolvedValue({
      id: 'listing-1',
      ownerId: 'user-1',
      status: ListingStatus.DRAFT,
      photos: Array.from({ length: 10 }, (_, index) => ({ order: index })),
    });

    await expect(
      service.uploadPhoto('user-1', 'listing-1', {}, {
        originalname: 'photo.png',
        mimetype: 'image/png',
        buffer: Buffer.from('image'),
      } as Express.Multer.File),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate photo order', async () => {
    prismaService.listing.findUnique.mockResolvedValue({
      id: 'listing-1',
      ownerId: 'user-1',
      status: ListingStatus.DRAFT,
      photos: [{ order: 0 }],
    });

    await expect(
      service.uploadPhoto('user-1', 'listing-1', { order: 0 }, {
        originalname: 'photo.png',
        mimetype: 'image/png',
        buffer: Buffer.from('image'),
      } as Express.Multer.File),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('publishes a draft listing with photos', async () => {
    prismaService.listing.findUnique.mockResolvedValue({
      id: 'listing-1',
      ownerId: 'user-1',
      status: ListingStatus.DRAFT,
      photos: [{ id: 'photo-1' }],
    });
    prismaService.listing.update.mockResolvedValue({
      id: 'listing-1',
      status: ListingStatus.ACTIVE,
    });

    const result = await service.publishListing('user-1', 'listing-1');

    expect(prismaService.listing.update).toHaveBeenCalledWith({
      where: { id: 'listing-1' },
      data: { status: ListingStatus.ACTIVE },
      select: { id: true, status: true },
    });
    expect(result).toEqual({
      id: 'listing-1',
      status: ListingStatus.ACTIVE,
      nextStep: null,
      message: 'Listing published successfully.',
    });
    expect(listingSearchIndex.indexListing).toHaveBeenCalledWith('listing-1');
  });

  it('rejects publishing without photos', async () => {
    prismaService.listing.findUnique.mockResolvedValue({
      id: 'listing-1',
      ownerId: 'user-1',
      status: ListingStatus.DRAFT,
      photos: [],
    });

    await expect(
      service.publishListing('user-1', 'listing-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
