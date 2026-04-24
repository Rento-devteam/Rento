-- CreateTable
CREATE TABLE "TelegramLoginAttempt" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "redirectUrl" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramLoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramLoginExchangeCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramLoginExchangeCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLoginAttempt_state_key" ON "TelegramLoginAttempt"("state");

-- CreateIndex
CREATE INDEX "TelegramLoginAttempt_expiresAt_idx" ON "TelegramLoginAttempt"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLoginExchangeCode_code_key" ON "TelegramLoginExchangeCode"("code");

-- CreateIndex
CREATE INDEX "TelegramLoginExchangeCode_attemptId_idx" ON "TelegramLoginExchangeCode"("attemptId");

-- CreateIndex
CREATE INDEX "TelegramLoginExchangeCode_userId_idx" ON "TelegramLoginExchangeCode"("userId");

-- CreateIndex
CREATE INDEX "TelegramLoginExchangeCode_expiresAt_idx" ON "TelegramLoginExchangeCode"("expiresAt");

-- AddForeignKey
ALTER TABLE "TelegramLoginExchangeCode" ADD CONSTRAINT "TelegramLoginExchangeCode_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "TelegramLoginAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramLoginExchangeCode" ADD CONSTRAINT "TelegramLoginExchangeCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
