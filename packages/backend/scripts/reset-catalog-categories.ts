/**
 * Очищает объявления/бронирования и оставляет в БД только заданные категории.
 *
 * Usage (from packages/backend, DATABASE_URL in .env):
 *   npx tsx scripts/reset-catalog-categories.ts
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const CATEGORIES = [
  { name: 'Для ремонта', slug: 'dlya-remonta', order: 1 },
  { name: 'Для детей', slug: 'dlya-detey', order: 2 },
  { name: 'Для авто', slug: 'dlya-avto', order: 3 },
  { name: 'Для дома', slug: 'dlya-doma', order: 4 },
  { name: 'Для питомцев', slug: 'dlya-pitomtsev', order: 5 },
  { name: 'Для хобби', slug: 'dlya-hobbi', order: 6 },
  { name: 'Разное', slug: 'raznoe', order: 7 },
] as const;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const deletedBookings = await prisma.booking.deleteMany();
    const deletedPhotos = await prisma.listingPhoto.deleteMany();
    const deletedBlocks = await prisma.listingManualCalendarBlock.deleteMany();
    const deletedListings = await prisma.listing.deleteMany();
    const deletedCategories = await prisma.category.deleteMany();

    for (const cat of CATEGORIES) {
      await prisma.category.create({
        data: {
          name: cat.name,
          slug: cat.slug,
          order: cat.order,
          isActive: true,
        },
      });
    }

    const categories = await prisma.category.findMany({
      orderBy: { order: 'asc' },
      select: { name: true, slug: true, order: true },
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          deleted: {
            bookings: deletedBookings.count,
            listingPhotos: deletedPhotos.count,
            calendarBlocks: deletedBlocks.count,
            listings: deletedListings.count,
            categories: deletedCategories.count,
          },
          categories,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
