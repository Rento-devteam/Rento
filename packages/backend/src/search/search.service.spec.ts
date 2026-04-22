import { ListingStatus, RentalPeriod } from '@prisma/client';
import { SearchService } from './search.service';

describe('SearchService', () => {
  const prismaService = {
    listing: {
      count: jest.fn(),
      findMany: jest.fn(),
      createMany: jest.fn(),
    },
    user: {
      upsert: jest.fn(),
    },
    category: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
  };

  const mockSearch = jest.fn();
  const client = {
    search: mockSearch,
  };
  const listingSearchIndex = {
    indexListing: jest.fn(),
  };

  let service: SearchService;

  beforeEach(() => {
    mockSearch.mockReset();
    prismaService.listing.count.mockReset();
    prismaService.listing.findMany.mockReset();
    prismaService.listing.createMany.mockReset();
    prismaService.user.upsert.mockReset();
    prismaService.category.findMany.mockReset();
    prismaService.category.upsert.mockReset();
    listingSearchIndex.indexListing.mockReset();
    prismaService.listing.count.mockResolvedValue(1);
    service = new SearchService(
      client as never,
      prismaService as never,
      listingSearchIndex as never,
    );
  });

  it('normalizeQuery strips stop words and lowercases', () => {
    expect(service.normalizeQuery('  Дрель И для  ')).toBe('дрель');
  });

  it('normalizeQuery returns lowercased text when only stop words remain', () => {
    expect(service.normalizeQuery('и в на')).toBe('и в на');
  });

  it('returns hydrated results in Elasticsearch hit order', async () => {
    mockSearch.mockResolvedValueOnce({
      hits: {
        total: { value: 2 },
        hits: [
          { _source: { listingId: 'b' } },
          { _source: { listingId: 'a' } },
        ],
      },
    });

    const listingB = {
      id: 'b',
      ownerId: 'u1',
      categoryId: 'c1',
      title: 'B',
      description: 'd',
      rentalPrice: 1,
      rentalPeriod: RentalPeriod.DAY,
      depositAmount: 1,
      status: ListingStatus.ACTIVE,
      latitude: null,
      longitude: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      category: {
        id: 'c1',
        name: 'Cat',
        slug: 'cat',
        icon: null,
        order: 0,
        isActive: true,
      },
      photos: [],
    };
    const listingA = { ...listingB, id: 'a', title: 'A' };

    prismaService.listing.findMany.mockResolvedValue([listingA, listingB]);

    const result = await service.search({
      q: 'дрель',
      page: 1,
      limit: 20,
      sort: 'relevance',
    });

    expect(mockSearch).toHaveBeenCalled();
    expect(result.totalCount).toBe(2);
    expect(result.emptyResults).toBe(false);
    expect(result.results.map((r) => r.id)).toEqual(['b', 'a']);
    expect(prismaService.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['b', 'a'] } },
      }),
    );
  });

  it('loads popular categories when there are no hits', async () => {
    mockSearch
      .mockResolvedValueOnce({
        hits: { total: { value: 0 }, hits: [] },
      })
      .mockResolvedValueOnce({
        hits: { total: { value: 0 }, hits: [] },
      });

    prismaService.category.findMany.mockResolvedValue([
      {
        id: 'c1',
        name: 'Tools',
        slug: 'tools',
        icon: null,
        order: 1,
        isActive: true,
      },
    ]);
    prismaService.listing.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    prismaService.listing.findMany.mockResolvedValueOnce([]);

    const result = await service.search({ q: 'zzz', page: 1, limit: 10 });

    expect(result.emptyResults).toBe(true);
    expect(result.popularCategories).toHaveLength(1);
    expect(result.popularCategories[0].slug).toBe('tools');
  });

  it('falls back to database search when Elasticsearch fails', async () => {
    mockSearch.mockRejectedValueOnce(new Error('connection refused'));
    const listing = {
      id: 'a',
      ownerId: 'u1',
      categoryId: 'c1',
      title: 'A',
      description: 'г. Москва, Тверская',
      rentalPrice: 120,
      rentalPeriod: RentalPeriod.HOUR,
      depositAmount: 500,
      status: ListingStatus.ACTIVE,
      latitude: null,
      longitude: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      category: {
        id: 'c1',
        name: 'Cat',
        slug: 'cat',
        icon: null,
        order: 0,
        isActive: true,
      },
      photos: [],
    };
    prismaService.listing.findMany.mockResolvedValue([listing]);
    prismaService.listing.count.mockResolvedValue(1);

    const result = await service.search({ q: 'x', page: 1, limit: 10 });
    expect(result.totalCount).toBe(1);
    expect(result.results[0]?.id).toBe('a');
  });

  it('falls back to database when Elasticsearch returns no hits', async () => {
    mockSearch
      .mockResolvedValueOnce({
        hits: { total: { value: 0 }, hits: [] },
      })
      .mockResolvedValueOnce({
        hits: { total: { value: 0 }, hits: [] },
      });

    const listing = {
      id: 'scooter-id',
      ownerId: 'u1',
      categoryId: 'c1',
      title: 'Электросамокат Ninebot',
      description: 'Городской транспорт',
      rentalPrice: 900,
      rentalPeriod: RentalPeriod.DAY,
      depositAmount: 2000,
      status: ListingStatus.ACTIVE,
      latitude: null,
      longitude: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      category: {
        id: 'c1',
        name: 'Транспорт',
        slug: 'transport',
        icon: null,
        order: 0,
        isActive: true,
      },
      photos: [],
    };
    prismaService.listing.count.mockResolvedValueOnce(1);
    prismaService.listing.findMany.mockResolvedValueOnce([listing]);

    const result = await service.search({
      q: 'электросамокат',
      page: 1,
      limit: 10,
    });

    expect(result.totalCount).toBe(1);
    expect(result.emptyResults).toBe(false);
    expect(result.relaxedMatch).toBe(true);
    expect(result.results[0]?.id).toBe('scooter-id');
  });
});
