import { PrismaService } from '../../src/prisma/prisma.service';

export async function cleanDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "ListingManualCalendarBlock",
      "Booking",
      "ListingPhoto",
      "Listing",
      "Category",
      "EmailConfirmationToken",
      "TelegramLinkCode",
      "RefreshToken",
      "User"
    RESTART IDENTITY CASCADE;
  `);
}
