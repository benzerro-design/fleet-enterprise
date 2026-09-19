-- FLEET-020: legătură 1:1 CostEntry ↔ VehicleDocument
ALTER TABLE "CostEntry" ADD COLUMN IF NOT EXISTS "vehicleDocumentId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "CostEntry_vehicleDocumentId_key" ON "CostEntry"("vehicleDocumentId");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CostEntry_vehicleDocumentId_fkey'
  ) THEN
    ALTER TABLE "CostEntry"
      ADD CONSTRAINT "CostEntry_vehicleDocumentId_fkey"
      FOREIGN KEY ("vehicleDocumentId") REFERENCES "VehicleDocument"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
