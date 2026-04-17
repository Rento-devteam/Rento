import 'dotenv/config';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PrismaModule } from '../src/prisma/prisma.module';
import { ListingSearchIndexService } from '../src/search/listing-search-index.service';
import { SearchModule } from '../src/search/search.module';

/** Minimal context: full AppModule pulls ListingsService and can hit circular DI via tsx. */
@Module({
  imports: [PrismaModule, SearchModule],
})
class ReindexModule {}

async function main() {
  const app = await NestFactory.createApplicationContext(ReindexModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const index = app.get(ListingSearchIndexService);
    const result = await index.reindexAllActiveListings();
    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
