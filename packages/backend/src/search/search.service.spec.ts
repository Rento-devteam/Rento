import { ServiceUnavailableException } from '@nestjs/common';
import { ListingStatus, RentalPeriod } from '@prisma/client';
import { SearchSort } from './dto/search-query.dto';
import { SearchService } from './search.service';

describe('SearchService', () => {
  const prismaService = {
    listing: {
      findMany: jest.fn(),
    },
    category: {
      findMany: jest.fn(),
    },
  };

  const mockSearch = jest.fn();
  const client = {
    search: mockSearch,
  };

  let service: SearchService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SearchService(client as never, prismaService as never);
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
      sort: SearchSort.relevance,
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

    const result = await service.search({ q: 'zzz', page: 1, limit: 10 });

    expect(result.emptyResults).toBe(true);
    expect(result.popularCategories).toHaveLength(1);
    expect(result.popularCategories[0].slug).toBe('tools');
  });

  it('throws ServiceUnavailable when Elasticsearch fails', async () => {
    mockSearch.mockRejectedValueOnce(new Error('connection refused'));

    await expect(service.search({ q: 'x' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
