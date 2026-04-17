-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "amountHeld" DOUBLE PRECISION,
ADD COLUMN     "endAt" TIMESTAMP(3),
ADD COLUMN     "paymentAuthorizationCode" TEXT,
ADD COLUMN     "paymentGateway" TEXT,
ADD COLUMN     "paymentHoldId" TEXT,
ADD COLUMN     "startAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Booking_startAt_endAt_idx" ON "Booking"("startAt", "endAt");
