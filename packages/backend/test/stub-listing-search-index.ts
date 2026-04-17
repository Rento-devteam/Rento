import { ListingSearchIndexService } from '../src/search/listing-search-index.service';

/**
 * E2E/integration tests must not connect to Elasticsearch during app bootstrap.
 */
export function createListingSearchIndexStub(): ListingSearchIndexService {
  return {
    onModuleInit: jest.fn().mockResolvedValue(undefined),
    ensureIndex: jest.fn().mockResolvedValue(undefined),
    indexListing: jest.fn().mockResolvedValue(undefined),
    removeListing: jest.fn().mockResolvedValue(undefined),
    reindexAllActiveListings: jest.fn().mockResolvedValue({ indexed: 0 }),
  } as unknown as ListingSearchIndexService;
}
