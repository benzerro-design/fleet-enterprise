-- CostEntry.tripId — legătură opțională alimentare ↔ cursă (Consum Faza A / FLEET-002)

ALTER TABLE "CostEntry" ADD COLUMN IF NOT EXISTS "tripId" TEXT;

CREATE INDEX IF NOT EXISTS "CostEntry_tripId_idx" ON "CostEntry"("tripId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CostEntry_tripId_fkey'
  ) THEN
    ALTER TABLE "CostEntry"
      ADD CONSTRAINT "CostEntry_tripId_fkey"
      FOREIGN KEY ("tripId") REFERENCES "Trip"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
