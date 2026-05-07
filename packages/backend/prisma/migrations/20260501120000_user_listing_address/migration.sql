-- AlterTable
ALTER TABLE "User" ADD COLUMN "addressText" TEXT,
ADD COLUMN "addressLatitude" DOUBLE PRECISION,
ADD COLUMN "addressLongitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN "addressText" TEXT;
