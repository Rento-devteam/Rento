-- Listing text moderation (rule-based + optional LLM) persisted on draft/active rows.

CREATE TYPE "ListingTextModerationStatus" AS ENUM ('ALLOW', 'WARN');

ALTER TABLE "Listing" ADD COLUMN "moderationStatus" "ListingTextModerationStatus" NOT NULL DEFAULT 'ALLOW';
ALTER TABLE "Listing" ADD COLUMN "moderationReasons" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Listing" ADD COLUMN "moderationVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Listing" ADD COLUMN "moderationConfidence" DOUBLE PRECISION;
