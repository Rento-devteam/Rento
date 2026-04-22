import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import { ListingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ELASTICSEARCH_CLIENT, getListingsIndexName } from './search.constants';

function completionInputs(title: string): string[] {
  const t = title.trim().toLowerCase();
  if (!t) {
    return [];
  }
  const tokens = t.split(/\s+/).filter((w) => w.length > 1);
  const inputs = new Set<string>([t]);
  for (const tok of tokens) {
    inputs.add(tok);
  }
  return [...inputs].slice(0, 50);
}

@Injectable()
export class ListingSearchIndexService implements OnModuleInit {
  private readonly logger = new Logger(ListingSearchIndexService.name);
  private readonly indexName = getListingsIndexName();

  constructor(
    @Inject(ELASTICSEARCH_CLIENT) private readonly client: Client,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    try {
      await this.ensureIndex();
    } catch (err) {
      this.logger.warn(
        `Elasticsearch index ensure failed (search may be unavailable): ${String(err)}`,
      );
    }
  }

  async ensureIndex(): Promise<void> {
    const exists = await this.client.indices.exists({ index: this.indexName });
    if (!exists) {
      await this.client.indices.create({
        index: this.indexName,
        mappings: {
          properties: {
            listingId: { type: 'keyword' },
            ownerId: { type: 'keyword' },
            title: { type: 'text', analyzer: 'russian' },
            description: { type: 'text', analyzer: 'russian' },
            categoryName: { type: 'text', analyzer: 'russian' },
            categoryId: { type: 'keyword' },
            status: { type: 'keyword' },
            rentalPrice: { type: 'float' },
            rentalPeriod: { type: 'keyword' },
            createdAt: { type: 'date' },
            location: { type: 'geo_point' },
            titleSuggest: {
              type: 'completion',
              analyzer: 'simple',
              preserve_separators: true,
            },
          },
        },
      });
      this.logger.log(`Created Elasticsearch index: ${this.indexName}`);
      return;
    }

    try {
      await this.client.indices.putMapping({
        index: this.indexName,
        properties: {
          ownerId: { type: 'keyword' },
        },
      });
    } catch {
      // ignore if field already exists or cluster rejects duplicate mapping
    }
  }

  async indexListing(listingId: string): Promise<void> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { category: true },
    });

    if (!listing || listing.status !== ListingStatus.ACTIVE) {
      await this.removeListing(listingId);
      return;
    }

    const doc: Record<string, unknown> = {
      listingId: listing.id,
      ownerId: listing.ownerId,
      title: listing.title,
      description: listing.description,
      categoryName: listing.category.name,
      categoryId: listing.categoryId,
      status: listing.status,
      rentalPrice: listing.rentalPrice,
      rentalPeriod: listing.rentalPeriod,
      createdAt: listing.createdAt.toISOString(),
      titleSuggest: {
        input: completionInputs(listing.title),
      },
    };

    if (listing.latitude != null && listing.longitude != null) {
      doc.location = {
        lat: listing.latitude,
        lon: listing.longitude,
      };
    }

    await this.client.index({
      index: this.indexName,
      id: listingId,
      document: doc,
      refresh: true,
    });
  }

  async removeListing(listingId: string): Promise<void> {
    try {
      await this.client.delete({
        index: this.indexName,
        id: listingId,
        refresh: true,
      });
    } catch (err: unknown) {
      const status =
        err && typeof err === 'object' && 'meta' in err
          ? (err as { meta?: { statusCode?: number } }).meta?.statusCode
          : undefined;
      if (status === 404) {
        return;
      }
      throw err;
    }
  }

  async reindexAllActiveListings(): Promise<{ indexed: number }> {
    const listings = await this.prisma.listing.findMany({
      where: { status: ListingStatus.ACTIVE },
      select: { id: true },
    });

    let indexed = 0;
    for (const { id } of listings) {
      await this.indexListing(id);
      indexed += 1;
    }

    return { indexed };
  }
}
