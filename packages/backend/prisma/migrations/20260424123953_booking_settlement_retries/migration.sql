-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "settlementLastAttemptAt" TIMESTAMP(3),
ADD COLUMN     "settlementNextRetryAt" TIMESTAMP(3),
ADD COLUMN     "settlementRetryCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Booking_settlementNextRetryAt_idx" ON "Booking"("settlementNextRetryAt");
