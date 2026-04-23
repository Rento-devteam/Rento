-- CreateEnum
CREATE TYPE "BookingSettlementStatus" AS ENUM ('NONE', 'PENDING', 'SETTLED', 'FAILED');

-- AlterTable
ALTER TABLE "Booking"
ADD COLUMN     "returnRenterConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "returnLandlordConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "returnMutualConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "returnAutoConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "returnConfirmationDeadlineAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "settlementStatus" "BookingSettlementStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "settlementError" TEXT,
ADD COLUMN     "settledAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Booking_returnConfirmationDeadlineAt_idx" ON "Booking"("returnConfirmationDeadlineAt");

-- CreateIndex
CREATE INDEX "Booking_settlementStatus_idx" ON "Booking"("settlementStatus");

