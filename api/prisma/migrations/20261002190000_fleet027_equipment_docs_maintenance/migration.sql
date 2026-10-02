-- FLEET-027: docs/reparații per echipare (FK opțional pe document + mentenanță)
ALTER TABLE "VehicleDocument" ADD COLUMN IF NOT EXISTS "vehicleEquipmentId" TEXT;
ALTER TABLE "MaintenanceEntry" ADD COLUMN IF NOT EXISTS "vehicleEquipmentId" TEXT;

CREATE INDEX IF NOT EXISTS "VehicleDocument_vehicleEquipmentId_idx" ON "VehicleDocument"("vehicleEquipmentId");
CREATE INDEX IF NOT EXISTS "MaintenanceEntry_vehicleEquipmentId_idx" ON "MaintenanceEntry"("vehicleEquipmentId");

DO $$ BEGIN
  ALTER TABLE "VehicleDocument"
    ADD CONSTRAINT "VehicleDocument_vehicleEquipmentId_fkey"
    FOREIGN KEY ("vehicleEquipmentId") REFERENCES "VehicleEquipment"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MaintenanceEntry"
    ADD CONSTRAINT "MaintenanceEntry_vehicleEquipmentId_fkey"
    FOREIGN KEY ("vehicleEquipmentId") REFERENCES "VehicleEquipment"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
