import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import type { estypes } from '@elastic/elasticsearch';
import {
  ListingStatus,
  Prisma,
  RentalPeriod,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { mapCategory, mapListingDetail } from '../listings/listing.mapper';
import { SearchQueryDto, SearchSort } from './dto/search-query.dto';
import {
  ELASTICSEARCH_CLIENT,
  RU_STOP_WORDS,
  getListingsIndexName,
} from './search.constants';
import { ListingSearchIndexService } from './listing-search-index.service';

export type SearchListingResult = ReturnType<typeof mapListingDetail>;

export interface SearchResponse {
  results: SearchListingResult[];
  totalCount: number;
  page: number;
  limit: number;
  emptyResults: boolean;
  suggestion: string | null;
  relaxedMatch: boolean;
  popularCategories: ReturnType<typeof mapCategory>[];
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly indexName = getListingsIndexName();

  constructor(
    @Inject(ELASTICSEARCH_CLIENT) private readonly client: Client,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    private readonly listingSearchIndex: ListingSearchIndexService,
  ) {}

  normalizeQuery(q: string | undefined): string {
    if (!q) {
      return '';
    }
    const lower = q.trim().toLowerCase();
    if (!lower) {
      return '';
    }
    const tokens = lower.split(/\s+/).filter((t) => !RU_STOP_WORDS.has(t));
    return tokens.length > 0 ? tokens.join(' ') : lower;
  }

  private splitQueryTokens(q: string): string[] {
    return q
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);
  }

  async search(
    dto: SearchQueryDto,
    excludeOwnerId?: string,
  ): Promise<SearchResponse> {
    await this.ensureDefaultCatalogSeeded();

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const from = (page - 1) * limit;

    if (
      (dto.distanceKm != null && (dto.lat == null || dto.lon == null)) ||
      ((dto.lat != null || dto.lon != null) &&
        (dto.lat == null || dto.lon == null))
    ) {
      throw new BadRequestException(
        'lat and lon are both required when using geo distance',
      );
    }

    if (
      dto.minPrice != null &&
      dto.maxPrice != null &&
      dto.minPrice > dto.maxPrice
    ) {
      throw new BadRequestException('minPrice cannot exceed maxPrice');
    }

    const normalizedQ = this.normalizeQuery(dto.q);
    const normalizedCity = this.normalizeQuery(dto.city);
    const sort = dto.sort ?? SearchSort.relevance;

    const filter: estypes.QueryDslQueryContainer[] = [
      { term: { status: 'ACTIVE' } },
    ];

    if (excludeOwnerId) {
      filter.push({
        bool: {
          must_not: [{ term: { ownerId: excludeOwnerId } }],
        },
      });
    }

    if (dto.categoryId) {
      filter.push({ term: { categoryId: dto.categoryId } });
    }

    if (normalizedCity) {
      filter.push({
        multi_match: {
          query: normalizedCity,
          fields: ['description', 'title'],
          operator: 'and',
        },
      });
    }

    if (dto.minPrice != null || dto.maxPrice != null) {
      const range: Record<string, number> = {};
      if (dto.minPrice != null) {
        range.gte = dto.minPrice;
      }
      if (dto.maxPrice != null) {
        range.lte = dto.maxPrice;
      }
      filter.push({ range: { rentalPrice: range } });
    }

    if (dto.lat != null && dto.lon != null && dto.distanceKm != null) {
      filter.push({
        geo_distance: {
          distance: `${dto.distanceKm}km`,
          location: { lat: dto.lat, lon: dto.lon },
        },
      });
    }

    const textQuery = this.buildTextQuery(normalizedQ, false);
    const textQueryFuzzy = this.buildTextQuery(normalizedQ, true);

    const baseBool: estypes.QueryDslBoolQuery = {
      must: normalizedQ ? [textQuery] : [{ match_all: {} }],
      filter,
    };

    const sortClause = this.buildSort(sort);

    try {
      let esRes = await this.client.search({
        index: this.indexName,
        from,
        size: limit,
        query: { bool: baseBool },
        sort: sortClause,
        track_total_hits: true,
      });

      let total =
        typeof esRes.hits.total === 'number'
          ? esRes.hits.total
          : (esRes.hits.total?.value ?? 0);

      let hits = esRes.hits.hits;
      let relaxedMatch = false;
      let suggestion: string | null = null;

      if (normalizedQ && total === 0) {
        const fuzzyBool: estypes.QueryDslBoolQuery = {
          must: [textQueryFuzzy],
          filter,
        };
        esRes = await this.client.search({
          index: this.indexName,
          from,
          size: limit,
          query: { bool: fuzzyBool },
          sort: sortClause,
          track_total_hits: true,
        });
        total =
          typeof esRes.hits.total === 'number'
            ? esRes.hits.total
            : (esRes.hits.total?.value ?? 0);
        hits = esRes.hits.hits;
        relaxedMatch = total > 0;
        if (relaxedMatch) {
          suggestion = await this.trySpellingSuggestion(normalizedQ);
        }
      }

      if (normalizedQ && total === 0) {
        const dbFallback = await this.searchFromDatabase(
          dto,
          normalizedQ,
          page,
          limit,
          excludeOwnerId,
        );
        if (dbFallback.totalCount > 0) {
          return {
            ...dbFallback,
            relaxedMatch: true,
            suggestion,
          };
        }
      }

      const orderedIds = hits
        .map((h) => (h._source as { listingId?: string })?.listingId)
        .filter((id): id is string => typeof id === 'string');

      const results =
        orderedIds.length > 0 ? await this.hydrateListings(orderedIds) : [];

      const emptyResults = total === 0;
      const popularCategories = emptyResults
        ? await this.loadPopularCategories()
        : [];

      return {
        results,
        totalCount: total,
        page,
        limit,
        emptyResults,
        suggestion,
        relaxedMatch,
        popularCategories,
      };
    } catch (err) {
      this.logger.error(`Elasticsearch search failed: ${String(err)}`);
      return this.searchFromDatabase(
        dto,
        normalizedQ,
        page,
        limit,
        excludeOwnerId,
      );
    }
  }

  private async searchFromDatabase(
    dto: SearchQueryDto,
    normalizedQ: string,
    page: number,
    limit: number,
    excludeOwnerId?: string,
  ): Promise<SearchResponse> {
    const skip = (page - 1) * limit;
    const normalizedCity = this.normalizeQuery(dto.city);

    const andWhere: Array<Record<string, unknown>> = [
      { status: ListingStatus.ACTIVE },
    ];

    if (excludeOwnerId) {
      andWhere.push({ ownerId: { not: excludeOwnerId } });
    }

    if (dto.categoryId) {
      andWhere.push({ categoryId: dto.categoryId });
    }

    if (dto.minPrice != null || dto.maxPrice != null) {
      andWhere.push({
        rentalPrice: {
          ...(dto.minPrice != null ? { gte: dto.minPrice } : {}),
          ...(dto.maxPrice != null ? { lte: dto.maxPrice } : {}),
        },
      });
    }

    if (normalizedQ) {
      const tokens = this.splitQueryTokens(normalizedQ);
      andWhere.push(
        ...tokens.map((token) => ({
          OR: [
            { title: { contains: token, mode: 'insensitive' } },
            { description: { contains: token, mode: 'insensitive' } },
            {
              category: {
                name: { contains: token, mode: 'insensitive' },
              },
            },
          ],
        })),
      );
    }

    if (normalizedCity) {
      andWhere.push({
        OR: [
          { description: { contains: normalizedCity, mode: 'insensitive' } },
          { title: { contains: normalizedCity, mode: 'insensitive' } },
        ],
      });
    }

    const where = { AND: andWhere };
    const orderBy = this.getDbOrderBy(dto.sort ?? SearchSort.relevance);

    const [totalCount, rows] = await Promise.all([
      this.prisma.listing.count({ where }),
      this.prisma.listing.findMany({
        where,
        include: {
          category: true,
          photos: { orderBy: { order: 'asc' } },
        },
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    const emptyResults = totalCount === 0;
    const popularCategories = emptyResults
      ? await this.loadPopularCategories()
      : [];

    return {
      results: rows.map(mapListingDetail),
      totalCount,
      page,
      limit,
      emptyResults,
      suggestion: null,
      relaxedMatch: false,
      popularCategories,
    };
  }

  private getDbOrderBy(
    sort: SearchSort,
  ): Prisma.ListingOrderByWithRelationInput[] {
    switch (sort) {
      case SearchSort.price_asc:
        return [{ rentalPrice: 'asc' }, { createdAt: 'desc' }];
      case SearchSort.price_desc:
        return [{ rentalPrice: 'desc' }, { createdAt: 'desc' }];
      case SearchSort.newest:
      case SearchSort.relevance:
      default:
        return [{ createdAt: 'desc' }];
    }
  }

  private buildTextQuery(
    normalizedQ: string,
    fuzzy: boolean,
  ): estypes.QueryDslQueryContainer {
    if (!normalizedQ) {
      return { match_all: {} };
    }

    const multiMatch: estypes.QueryDslMultiMatchQuery = {
      query: normalizedQ,
      fields: ['title^3', 'categoryName^2', 'description'],
      type: 'best_fields',
    };
    if (fuzzy) {
      multiMatch.fuzziness = 'AUTO';
    }

    return {
      bool: {
        should: [
          { multi_match: multiMatch },
          {
            match_phrase: {
              title: { query: normalizedQ, boost: 2 },
            },
          },
        ],
        minimum_should_match: 1,
      },
    };
  }

  private buildSort(sort: SearchSort): estypes.Sort {
    switch (sort) {
      case SearchSort.price_asc:
        return [{ rentalPrice: 'asc' }, { createdAt: 'desc' }];
      case SearchSort.price_desc:
        return [{ rentalPrice: 'desc' }, { createdAt: 'desc' }];
      case SearchSort.newest:
        return [{ createdAt: 'desc' }];
      case SearchSort.relevance:
      default:
        return [{ _score: { order: 'desc' } }, { createdAt: 'desc' }];
    }
  }

  private async trySpellingSuggestion(text: string): Promise<string | null> {
    try {
      const res = await this.client.search({
        index: this.indexName,
        size: 0,
        suggest: {
          spell_title: {
            text,
            term: {
              field: 'title',
              suggest_mode: 'popular',
              min_word_length: 3,
            },
          },
        },
      });

      const spellBlock = res.suggest?.spell_title;
      const spellEntry =
        Array.isArray(spellBlock) && spellBlock.length > 0
          ? spellBlock[0]
          : undefined;
      const options = spellEntry?.options;
      const first =
        Array.isArray(options) && options.length > 0 ? options[0] : undefined;
      const candidateText =
        first &&
        typeof first === 'object' &&
        'text' in first &&
        typeof (first as { text: unknown }).text === 'string'
          ? (first as { text: string }).text
          : null;
      if (candidateText && candidateText !== text) {
        return candidateText;
      }
    } catch {
      return null;
    }
    return null;
  }

  private async hydrateListings(orderedIds: string[]) {
    const listings = await this.prisma.listing.findMany({
      where: { id: { in: orderedIds } },
      include: {
        category: true,
        photos: { orderBy: { order: 'asc' } },
      },
    });

    const byId = new Map(listings.map((l) => [l.id, l]));
    return orderedIds
      .map((id) => byId.get(id))
      .filter((l): l is NonNullable<typeof l> => l != null)
      .map(mapListingDetail);
  }

  private async loadPopularCategories() {
    const rows = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      take: 10,
    });
    return rows.map(mapCategory);
  }

  async autocomplete(q: string, limit: number): Promise<string[]> {
    const prefix = q.trim().toLowerCase();
    if (!prefix) {
      return [];
    }

    try {
      const res = await this.client.search({
        index: this.indexName,
        size: limit,
        _source: ['title', 'listingId'],
        query: {
          bool: {
            must: [
              {
                match_bool_prefix: {
                  title: { query: prefix },
                },
              },
            ],
            filter: [{ term: { status: 'ACTIVE' } }],
          },
        },
        sort: [{ _score: { order: 'desc' } }, { createdAt: 'desc' }],
      });

      const seen = new Set<string>();
      const out: string[] = [];
      for (const hit of res.hits.hits) {
        const title = (hit._source as { title?: string })?.title;
        if (title && !seen.has(title)) {
          seen.add(title);
          out.push(title);
          if (out.length >= limit) {
            break;
          }
        }
      }
      return out;
    } catch (err) {
      this.logger.error(`Elasticsearch autocomplete failed: ${String(err)}`);
      return [];
    }
  }

  private async ensureDefaultCatalogSeeded(): Promise<void> {
    const activeCount = await this.prisma.listing.count({
      where: { status: ListingStatus.ACTIVE },
    });
    if (activeCount > 0) {
      return;
    }

    const category = await this.prisma.category.upsert({
      where: { slug: 'default-catalog' },
      update: { isActive: true },
      create: {
        name: 'Разное',
        slug: 'default-catalog',
        icon: null,
        order: 999,
        isActive: true,
      },
    });

    const owner = await this.prisma.user.upsert({
      where: { email: 'catalog@rento.local' },
      update: {
        status: UserStatus.ACTIVE,
        emailConfirmedAt: new Date(),
      },
      create: {
        email: 'catalog@rento.local',
        status: UserStatus.ACTIVE,
        emailConfirmedAt: new Date(),
      },
    });

    const defaults = [
      {
        title: 'Электросамокат Ninebot',
        description: 'Городской электросамокат. г. Москва, ул. Тверская, 7',
        rentalPrice: 350,
        depositAmount: 3000,
      },
      {
        title: 'Шуруповерт Makita',
        description:
          'Аккумуляторный шуруповерт для ремонта. г. Санкт-Петербург, Невский пр., 18',
        rentalPrice: 250,
        depositAmount: 2000,
      },
      {
        title: 'GoPro Hero',
        description:
          'Экшн-камера 4K для путешествий. г. Казань, ул. Баумана, 12',
        rentalPrice: 500,
        depositAmount: 5000,
      },
    ];

    await this.prisma.listing.createMany({
      data: defaults.map((item) => ({
        ownerId: owner.id,
        categoryId: category.id,
        title: item.title,
        description: item.description,
        rentalPrice: item.rentalPrice,
        rentalPeriod: RentalPeriod.DAY,
        depositAmount: item.depositAmount,
        status: ListingStatus.ACTIVE,
      })),
    });

    const created = await this.prisma.listing.findMany({
      where: {
        ownerId: owner.id,
        categoryId: category.id,
        status: ListingStatus.ACTIVE,
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
      take: defaults.length,
    });

    for (const row of created) {
      try {
        await this.listingSearchIndex.indexListing(row.id);
      } catch (err) {
        this.logger.warn(
          `Failed to index default listing ${row.id}: ${String(err)}`,
        );
      }
    }
  }
}
