-- RSA-S4: km + legătură settlement → CostEntry pe misiune tractare.

ALTER TABLE "RsaTowMission" ADD COLUMN IF NOT EXISTS "distanceKm" INTEGER;
ALTER TABLE "RsaTowMission" ADD COLUMN IF NOT EXISTS "settlementCostEntryId" TEXT;
ALTER TABLE "RsaTowMission" ADD COLUMN IF NOT EXISTS "settledAt" TIMESTAMP(3);
ALTER TABLE "RsaTowMission" ADD COLUMN IF NOT EXISTS "settlementAmountCents" INTEGER;
ALTER TABLE "RsaTowMission" ADD COLUMN IF NOT EXISTS "settlementBreakdownJson" JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS "RsaTowMission_settlementCostEntryId_key"
  ON "RsaTowMission"("settlementCostEntryId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RsaTowMission_settlementCostEntryId_fkey'
  ) THEN
    ALTER TABLE "RsaTowMission"
      ADD CONSTRAINT "RsaTowMission_settlementCostEntryId_fkey"
      FOREIGN KEY ("settlementCostEntryId") REFERENCES "CostEntry"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
