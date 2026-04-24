-- CreateTable
CREATE TABLE "TrustScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentScore" INTEGER NOT NULL,
    "totalDeals" INTEGER NOT NULL,
    "successfulDeals" INTEGER NOT NULL,
    "lateReturns" INTEGER NOT NULL,
    "disputes" INTEGER NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrustScore_userId_key" ON "TrustScore"("userId");

-- CreateIndex
CREATE INDEX "TrustScore_currentScore_idx" ON "TrustScore"("currentScore");

-- CreateIndex
CREATE INDEX "TrustScore_calculatedAt_idx" ON "TrustScore"("calculatedAt");

-- AddForeignKey
ALTER TABLE "TrustScore" ADD CONSTRAINT "TrustScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
