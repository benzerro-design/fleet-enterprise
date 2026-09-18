-- UAT-041: dus / dus-întors pe cursă
-- FLEET-016: echipări montate pe vehicul

ALTER TABLE "Trip" ADD COLUMN "isRoundTrip" BOOLEAN NOT NULL DEFAULT false;

CREATE TYPE "VehicleEquipmentKind" AS ENUM ('tow_hitch', 'fridge_unit', 'liftgate', 'crane', 'other');

CREATE TABLE "VehicleEquipment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "kind" "VehicleEquipmentKind" NOT NULL DEFAULT 'other',
    "label" TEXT NOT NULL,
    "serialNumber" TEXT,
    "mountedOn" TIMESTAMP(3),
    "removedOn" TIMESTAMP(3),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VehicleEquipment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VehicleEquipment_tenantId_idx" ON "VehicleEquipment"("tenantId");
CREATE INDEX "VehicleEquipment_vehicleId_idx" ON "VehicleEquipment"("vehicleId");
CREATE INDEX "VehicleEquipment_vehicleId_isActive_idx" ON "VehicleEquipment"("vehicleId", "isActive");

ALTER TABLE "VehicleEquipment" ADD CONSTRAINT "VehicleEquipment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleEquipment" ADD CONSTRAINT "VehicleEquipment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
