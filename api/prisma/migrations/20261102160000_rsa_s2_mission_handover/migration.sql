-- RSA-S2 / S2b: misiune teren + PV digital + semnături + media

CREATE TYPE "RsaMissionStatus" AS ENUM (
  'assigned', 'en_route', 'on_scene', 'picked_up', 'in_transit', 'delivered', 'closed', 'cancelled'
);
CREATE TYPE "RsaHandoverKind" AS ENUM ('pickup', 'dropoff');
CREATE TYPE "RsaHandoverProtocolStatus" AS ENUM ('draft', 'signed', 'voided');
CREATE TYPE "RsaHandoverSignerRole" AS ENUM ('driver', 'customer', 'receiver', 'witness');
CREATE TYPE "RsaHandoverMediaKind" AS ENUM (
  'front', 'rear', 'left', 'right', 'damage', 'interior', 'odometer', 'other'
);

CREATE TABLE "RsaTowMission" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "interventionId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "driverUserId" TEXT,
  "driverDisplayName" TEXT,
  "platformPlate" TEXT,
  "status" "RsaMissionStatus" NOT NULL DEFAULT 'assigned',
  "pickupLocationText" TEXT,
  "dropoffLocationText" TEXT,
  "etaMinutes" INTEGER,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "enRouteAt" TIMESTAMP(3),
  "onSceneAt" TIMESTAMP(3),
  "pickedUpAt" TIMESTAMP(3),
  "inTransitAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "cancelReason" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RsaTowMission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RsaTowMission_interventionId_key" ON "RsaTowMission"("interventionId");
CREATE INDEX "RsaTowMission_tenantId_status_idx" ON "RsaTowMission"("tenantId", "status");
CREATE INDEX "RsaTowMission_tenantId_supplierId_status_idx" ON "RsaTowMission"("tenantId", "supplierId", "status");
CREATE INDEX "RsaTowMission_driverUserId_idx" ON "RsaTowMission"("driverUserId");

ALTER TABLE "RsaTowMission"
  ADD CONSTRAINT "RsaTowMission_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RsaTowMission"
  ADD CONSTRAINT "RsaTowMission_interventionId_fkey"
  FOREIGN KEY ("interventionId") REFERENCES "RoadsideIntervention"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RsaTowMission"
  ADD CONSTRAINT "RsaTowMission_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RsaTowMission"
  ADD CONSTRAINT "RsaTowMission_driverUserId_fkey"
  FOREIGN KEY ("driverUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "RsaHandoverProtocol" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "kind" "RsaHandoverKind" NOT NULL,
  "status" "RsaHandoverProtocolStatus" NOT NULL DEFAULT 'draft',
  "locationText" TEXT,
  "odometerKm" INTEGER,
  "fuelLevelPct" INTEGER,
  "damageNotes" TEXT,
  "inventoryNotes" TEXT,
  "checklistJson" JSONB NOT NULL DEFAULT '{}',
  "counterpartyName" TEXT,
  "counterpartyRoleNote" TEXT,
  "signedAt" TIMESTAMP(3),
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RsaHandoverProtocol_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RsaHandoverProtocol_missionId_kind_key" ON "RsaHandoverProtocol"("missionId", "kind");
CREATE INDEX "RsaHandoverProtocol_tenantId_missionId_idx" ON "RsaHandoverProtocol"("tenantId", "missionId");
CREATE INDEX "RsaHandoverProtocol_tenantId_status_idx" ON "RsaHandoverProtocol"("tenantId", "status");

ALTER TABLE "RsaHandoverProtocol"
  ADD CONSTRAINT "RsaHandoverProtocol_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RsaHandoverProtocol"
  ADD CONSTRAINT "RsaHandoverProtocol_missionId_fkey"
  FOREIGN KEY ("missionId") REFERENCES "RsaTowMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RsaHandoverSignature" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "protocolId" TEXT NOT NULL,
  "role" "RsaHandoverSignerRole" NOT NULL,
  "displayName" TEXT NOT NULL,
  "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "signaturePngUrl" TEXT NOT NULL,
  "strokePathJson" JSONB,
  "deviceMetaJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RsaHandoverSignature_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RsaHandoverSignature_protocolId_idx" ON "RsaHandoverSignature"("protocolId");
CREATE INDEX "RsaHandoverSignature_tenantId_protocolId_idx" ON "RsaHandoverSignature"("tenantId", "protocolId");

ALTER TABLE "RsaHandoverSignature"
  ADD CONSTRAINT "RsaHandoverSignature_protocolId_fkey"
  FOREIGN KEY ("protocolId") REFERENCES "RsaHandoverProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RsaHandoverMedia" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "protocolId" TEXT NOT NULL,
  "kind" "RsaHandoverMediaKind" NOT NULL DEFAULT 'other',
  "fileUrl" TEXT NOT NULL,
  "fileName" TEXT,
  "caption" TEXT,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RsaHandoverMedia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RsaHandoverMedia_protocolId_idx" ON "RsaHandoverMedia"("protocolId");
CREATE INDEX "RsaHandoverMedia_tenantId_protocolId_idx" ON "RsaHandoverMedia"("tenantId", "protocolId");

ALTER TABLE "RsaHandoverMedia"
  ADD CONSTRAINT "RsaHandoverMedia_protocolId_fkey"
  FOREIGN KEY ("protocolId") REFERENCES "RsaHandoverProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;
