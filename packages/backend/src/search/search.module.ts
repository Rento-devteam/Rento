import { Module } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import { PrismaModule } from '../prisma/prisma.module';
import { ELASTICSEARCH_CLIENT } from './search.constants';
import { ListingSearchIndexService } from './listing-search-index.service';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [PrismaModule],
  controllers: [SearchController],
  providers: [
    {
      provide: ELASTICSEARCH_CLIENT,
      useFactory: () =>
        new Client({
          node: process.env.ELASTICSEARCH_NODE ?? 'http://127.0.0.1:9200',
          requestTimeout: 30_000,
          sniffOnStart: false,
        }),
    },
    ListingSearchIndexService,
    SearchService,
  ],
  exports: [ListingSearchIndexService],
})
export class SearchModule {}
