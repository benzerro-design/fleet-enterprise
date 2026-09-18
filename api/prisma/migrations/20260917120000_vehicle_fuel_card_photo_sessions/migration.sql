-- FLEET-023: card combustibil pe vehicul
-- FLEET-024: sesiuni / tip pe fotografii vehicul

CREATE TYPE "FuelCardStatus" AS ENUM ('active', 'inactive', 'blocked');
CREATE TYPE "VehiclePhotoKind" AS ENUM ('exterior', 'interior', 'damage', 'document', 'other');

ALTER TABLE "Vehicle"
  ADD COLUMN "fuelCardNumber" TEXT,
  ADD COLUMN "fuelCardProvider" TEXT,
  ADD COLUMN "fuelCardAccountRef" TEXT,
  ADD COLUMN "fuelCardStatus" "FuelCardStatus";

ALTER TABLE "VehiclePhoto"
  ADD COLUMN "sessionLabel" TEXT,
  ADD COLUMN "kind" "VehiclePhotoKind";

CREATE INDEX "VehiclePhoto_vehicleId_sessionLabel_idx" ON "VehiclePhoto"("vehicleId", "sessionLabel");
