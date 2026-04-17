import { UnprocessableEntityException } from '@nestjs/common';
import { ListingStatus, RentalPeriod } from '@prisma/client';
import { ListingsService } from './listings.service';

describe('ListingsService', () => {
  const usersService = {
    assertUserCanCreateListing: jest.fn(async () => undefined),
  };

  const prismaService = {
    category: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    listing: {
      create: jest.fn(),
    },
  };

  let service: ListingsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ListingsService(prismaService as never, usersService as never);
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

    expect(usersService.assertUserCanCreateListing).toHaveBeenCalledWith('user-1');
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
});
