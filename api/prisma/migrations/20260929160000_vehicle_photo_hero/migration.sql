-- Hero photo flag + index
ALTER TABLE "VehiclePhoto" ADD COLUMN IF NOT EXISTS "isHero" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "VehiclePhoto_vehicleId_isHero_idx" ON "VehiclePhoto"("vehicleId", "isHero");
