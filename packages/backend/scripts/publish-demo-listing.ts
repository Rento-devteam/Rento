/**
 * Makes the demo listing from seed-demo-listing ACTIVE (adds a placeholder photo if needed)
 * so it can be indexed for search / UC-09 verification.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { ListingStatus, PrismaClient } from '@prisma/client';

const DEMO_TITLE = 'Демо: перфоратор Makita HR2470';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const listing = await prisma.listing.findFirst({
      where: { title: DEMO_TITLE },
    });
    if (!listing) {
      throw new Error('Demo listing not found. Run: npm run seed:demo-listing');
    }

    const photoCount = await prisma.listingPhoto.count({
      where: { listingId: listing.id },
    });
    if (photoCount === 0) {
      await prisma.listingPhoto.create({
        data: {
          listingId: listing.id,
          url: 'https://example.com/demo-perforator-placeholder.jpg',
          thumbnailUrl: null,
          order: 0,
          isPrimary: true,
        },
      });
    }

    await prisma.listing.update({
      where: { id: listing.id },
      data: { status: ListingStatus.ACTIVE },
    });

    console.log(
      JSON.stringify(
        { ok: true, listingId: listing.id, status: ListingStatus.ACTIVE },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
