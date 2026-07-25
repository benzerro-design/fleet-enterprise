-- CreateEnum
CREATE TYPE "DamageQuoteOrigin" AS ENUM ('prepared_by_us', 'received_from_insurer');

-- AlterTable
ALTER TABLE "ServiceCase"
ADD COLUMN "damageInsurerEmail" TEXT,
ADD COLUMN "damageQuoteOrigin" "DamageQuoteOrigin",
ADD COLUMN "damageInsurerQuotePdfUrl" TEXT,
ADD COLUMN "damageInsurerMailLogJson" JSONB;
