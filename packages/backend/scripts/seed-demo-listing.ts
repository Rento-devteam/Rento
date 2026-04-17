import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  ListingStatus,
  PrismaClient,
  RentalPeriod,
  UserStatus,
} from '@prisma/client';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  const demoEmail = 'demo.listings.seed@rento.local';
  const demoPassword = 'Demo!List1ng#2026';
  const listingTitle = 'Демо: перфоратор Makita HR2470';

  try {
    const category = await prisma.category.upsert({
      where: { slug: 'demo-power-tools' },
      create: {
        name: 'Электроинструмент',
        slug: 'demo-power-tools',
        order: 1,
        isActive: true,
      },
      update: { isActive: true },
    });

    const passwordHash = await bcrypt.hash(demoPassword, 10);
    const user = await prisma.user.upsert({
      where: { email: demoEmail },
      create: {
        email: demoEmail,
        passwordHash,
        status: UserStatus.ACTIVE,
        fullName: 'Демо владелец объявлений',
        emailConfirmedAt: new Date(),
      },
      update: {
        status: UserStatus.ACTIVE,
        emailConfirmedAt: new Date(),
      },
    });

    const existing = await prisma.listing.findFirst({
      where: { ownerId: user.id, title: listingTitle },
    });

    const listing =
      existing ??
      (await prisma.listing.create({
        data: {
          ownerId: user.id,
          categoryId: category.id,
          title: listingTitle,
          description:
            'Тестовое объявление из seed-скрипта: перфоратор в хорошем состоянии, кабель 3 м.',
          rentalPrice: 850,
          rentalPeriod: RentalPeriod.DAY,
          depositAmount: 5000,
          status: ListingStatus.DRAFT,
          latitude: 55.751244,
          longitude: 37.618423,
        },
      }));

    console.log(JSON.stringify({ ok: true, demoEmail, demoPassword, listingId: listing.id }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
