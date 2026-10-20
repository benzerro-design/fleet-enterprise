-- FLEET-007 P0 — tire foundation (assets, sets, placements, events).

-- CreateEnum
CREATE TYPE "TireOwnershipType" AS ENUM ('client', 'fleet', 'supplier_stock');
CREATE TYPE "TireMountedAs" AS ENUM ('on_rim', 'tyre_only');
CREATE TYPE "TirePlacementKind" AS ENUM ('on_vehicle', 'at_client', 'at_supplier_hotel', 'in_transit', 'scrap', 'quarantine');
CREATE TYPE "TireEventType" AS ENUM ('purchase', 'mount', 'demount', 'rotate', 'inspect', 'repair', 'store', 'release', 'scrap', 'transfer');
CREATE TYPE "TireAssetProvenance" AS ENUM ('verified', 'inferred', 'unknown');

-- AlterEnum
ALTER TYPE "SupplierServiceKind" ADD VALUE 'tire_storage';

-- CreateTable
CREATE TABLE "RimAsset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT,
    "size" TEXT,
    "material" "VehicleRimMaterial",
    "lugNutCount" INTEGER,
    "notes" TEXT,
    "ownershipType" "TireOwnershipType" NOT NULL DEFAULT 'client',
    "ownerClientId" TEXT,
    "provenance" "TireAssetProvenance" NOT NULL DEFAULT 'inferred',
    "externalId" TEXT,
    "sourceSystem" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RimAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TireAsset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT,
    "size" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "season" "VehicleTireSeason" NOT NULL DEFAULT 'unknown',
    "speedIndex" TEXT,
    "loadIndex" TEXT,
    "commercialC" BOOLEAN NOT NULL DEFAULT false,
    "runFlat" BOOLEAN NOT NULL DEFAULT false,
    "xl" BOOLEAN NOT NULL DEFAULT false,
    "seal" BOOLEAN NOT NULL DEFAULT false,
    "foam" BOOLEAN NOT NULL DEFAULT false,
    "dot" TEXT,
    "treadMm" DOUBLE PRECISION,
    "serialOrQr" TEXT,
    "ownershipType" "TireOwnershipType" NOT NULL DEFAULT 'client',
    "ownerClientId" TEXT,
    "ownerSupplierId" TEXT,
    "provenance" "TireAssetProvenance" NOT NULL DEFAULT 'inferred',
    "recommendedReplace" BOOLEAN NOT NULL DEFAULT false,
    "tpmsSensorPresent" BOOLEAN NOT NULL DEFAULT false,
    "valveType" TEXT,
    "rimAssetId" TEXT,
    "attrs" JSONB,
    "externalId" TEXT,
    "sourceSystem" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TireAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TireSet" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "season" "VehicleTireSeason" NOT NULL,
    "name" TEXT,
    "mountedAs" "TireMountedAs" NOT NULL DEFAULT 'on_rim',
    "archivedAt" TIMESTAMP(3),
    "externalId" TEXT,
    "sourceSystem" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TireSet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TireSetItem" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TireSetItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TirePlacement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "kind" "TirePlacementKind" NOT NULL,
    "vehicleId" TEXT,
    "position" "VehicleWheelPosition",
    "supplierId" TEXT,
    "locationCode" TEXT,
    "setId" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TirePlacement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TireEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "TireEventType" NOT NULL,
    "assetId" TEXT,
    "setId" TEXT,
    "rimAssetId" TEXT,
    "vehicleId" TEXT,
    "workOrderId" TEXT,
    "payload" JSONB,
    "odometerKm" INTEGER,
    "actorUserId" TEXT,
    "externalId" TEXT,
    "sourceSystem" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TireEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RimAsset_tenantId_idx" ON "RimAsset"("tenantId");
CREATE INDEX "RimAsset_clientId_idx" ON "RimAsset"("clientId");

CREATE INDEX "TireAsset_tenantId_idx" ON "TireAsset"("tenantId");
CREATE INDEX "TireAsset_clientId_idx" ON "TireAsset"("clientId");
CREATE INDEX "TireAsset_rimAssetId_idx" ON "TireAsset"("rimAssetId");
CREATE INDEX "TireAsset_ownerSupplierId_idx" ON "TireAsset"("ownerSupplierId");

CREATE INDEX "TireSet_tenantId_idx" ON "TireSet"("tenantId");
CREATE INDEX "TireSet_vehicleId_idx" ON "TireSet"("vehicleId");
CREATE INDEX "TireSet_clientId_idx" ON "TireSet"("clientId");

CREATE UNIQUE INDEX "TireSetItem_setId_assetId_key" ON "TireSetItem"("setId", "assetId");
CREATE INDEX "TireSetItem_assetId_idx" ON "TireSetItem"("assetId");

CREATE INDEX "TirePlacement_assetId_validTo_idx" ON "TirePlacement"("assetId", "validTo");
CREATE INDEX "TirePlacement_tenantId_idx" ON "TirePlacement"("tenantId");
CREATE INDEX "TirePlacement_vehicleId_idx" ON "TirePlacement"("vehicleId");

CREATE INDEX "TireEvent_tenantId_idx" ON "TireEvent"("tenantId");
CREATE INDEX "TireEvent_assetId_idx" ON "TireEvent"("assetId");
CREATE INDEX "TireEvent_vehicleId_idx" ON "TireEvent"("vehicleId");
CREATE INDEX "TireEvent_setId_idx" ON "TireEvent"("setId");
CREATE INDEX "TireEvent_workOrderId_idx" ON "TireEvent"("workOrderId");

-- AddForeignKey
ALTER TABLE "RimAsset" ADD CONSTRAINT "RimAsset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RimAsset" ADD CONSTRAINT "RimAsset_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TireAsset" ADD CONSTRAINT "TireAsset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TireAsset" ADD CONSTRAINT "TireAsset_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TireAsset" ADD CONSTRAINT "TireAsset_ownerSupplierId_fkey" FOREIGN KEY ("ownerSupplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TireAsset" ADD CONSTRAINT "TireAsset_rimAssetId_fkey" FOREIGN KEY ("rimAssetId") REFERENCES "RimAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TireSet" ADD CONSTRAINT "TireSet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TireSet" ADD CONSTRAINT "TireSet_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TireSet" ADD CONSTRAINT "TireSet_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TireSetItem" ADD CONSTRAINT "TireSetItem_setId_fkey" FOREIGN KEY ("setId") REFERENCES "TireSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TireSetItem" ADD CONSTRAINT "TireSetItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "TireAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TirePlacement" ADD CONSTRAINT "TirePlacement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TirePlacement" ADD CONSTRAINT "TirePlacement_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "TireAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TirePlacement" ADD CONSTRAINT "TirePlacement_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TirePlacement" ADD CONSTRAINT "TirePlacement_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TirePlacement" ADD CONSTRAINT "TirePlacement_setId_fkey" FOREIGN KEY ("setId") REFERENCES "TireSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TireEvent" ADD CONSTRAINT "TireEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TireEvent" ADD CONSTRAINT "TireEvent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "TireAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TireEvent" ADD CONSTRAINT "TireEvent_setId_fkey" FOREIGN KEY ("setId") REFERENCES "TireSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TireEvent" ADD CONSTRAINT "TireEvent_rimAssetId_fkey" FOREIGN KEY ("rimAssetId") REFERENCES "RimAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TireEvent" ADD CONSTRAINT "TireEvent_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TireEvent" ADD CONSTRAINT "TireEvent_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "MaintenanceWorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TireEvent" ADD CONSTRAINT "TireEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
