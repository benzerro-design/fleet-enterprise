-- FLEET-007 S4: optional CostEntry ↔ tire asset / set / storage stay
ALTER TABLE "CostEntry" ADD COLUMN IF NOT EXISTS "tireAssetId" TEXT;
ALTER TABLE "CostEntry" ADD COLUMN IF NOT EXISTS "tireSetId" TEXT;
ALTER TABLE "CostEntry" ADD COLUMN IF NOT EXISTS "tireStorageStayId" TEXT;

CREATE INDEX IF NOT EXISTS "CostEntry_tireAssetId_idx" ON "CostEntry"("tireAssetId");
CREATE INDEX IF NOT EXISTS "CostEntry_tireSetId_idx" ON "CostEntry"("tireSetId");
CREATE INDEX IF NOT EXISTS "CostEntry_tireStorageStayId_idx" ON "CostEntry"("tireStorageStayId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CostEntry_tireAssetId_fkey'
  ) THEN
    ALTER TABLE "CostEntry"
      ADD CONSTRAINT "CostEntry_tireAssetId_fkey"
      FOREIGN KEY ("tireAssetId") REFERENCES "TireAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CostEntry_tireSetId_fkey'
  ) THEN
    ALTER TABLE "CostEntry"
      ADD CONSTRAINT "CostEntry_tireSetId_fkey"
      FOREIGN KEY ("tireSetId") REFERENCES "TireSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CostEntry_tireStorageStayId_fkey'
  ) THEN
    ALTER TABLE "CostEntry"
      ADD CONSTRAINT "CostEntry_tireStorageStayId_fkey"
      FOREIGN KEY ("tireStorageStayId") REFERENCES "TireStorageStay"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
