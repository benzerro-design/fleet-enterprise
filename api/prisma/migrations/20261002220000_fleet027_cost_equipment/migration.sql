-- FLEET-027: costuri ops atribuite autovehicul vs echipare
ALTER TABLE "CostEntry" ADD COLUMN IF NOT EXISTS "vehicleEquipmentId" TEXT;

CREATE INDEX IF NOT EXISTS "CostEntry_vehicleEquipmentId_idx" ON "CostEntry"("vehicleEquipmentId");

DO $$ BEGIN
  ALTER TABLE "CostEntry"
    ADD CONSTRAINT "CostEntry_vehicleEquipmentId_fkey"
    FOREIGN KEY ("vehicleEquipmentId") REFERENCES "VehicleEquipment"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
