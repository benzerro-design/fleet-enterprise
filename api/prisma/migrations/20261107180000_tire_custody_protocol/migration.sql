-- FLEET-007 Build #1: tire custody protocols (RSA-shaped, stay-scoped)

CREATE TYPE "TireCustodyProtocolKind" AS ENUM ('check_in', 'check_out', 'seasonal');
CREATE TYPE "TireCustodyProtocolStatus" AS ENUM ('draft', 'signed', 'voided');
CREATE TYPE "TireCustodySignerRole" AS ENUM ('partner', 'customer', 'driver', 'witness');

CREATE TABLE "TireCustodyProtocol" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "stayId" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "kind" "TireCustodyProtocolKind" NOT NULL,
    "status" "TireCustodyProtocolStatus" NOT NULL DEFAULT 'draft',
    "locationText" TEXT,
    "conditionNotes" TEXT,
    "inventoryNotes" TEXT,
    "checklistJson" JSONB NOT NULL DEFAULT '{}',
    "counterpartyName" TEXT,
    "counterpartyRoleNote" TEXT,
    "signedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TireCustodyProtocol_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TireCustodySignature" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "role" "TireCustodySignerRole" NOT NULL,
    "displayName" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signaturePngUrl" TEXT NOT NULL,
    "strokePathJson" JSONB,
    "deviceMetaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TireCustodySignature_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TireCustodyProtocol_stayId_kind_key" ON "TireCustodyProtocol"("stayId", "kind");
CREATE INDEX "TireCustodyProtocol_tenantId_stayId_idx" ON "TireCustodyProtocol"("tenantId", "stayId");
CREATE INDEX "TireCustodyProtocol_tenantId_supplierId_status_idx" ON "TireCustodyProtocol"("tenantId", "supplierId", "status");
CREATE INDEX "TireCustodyProtocol_tenantId_setId_idx" ON "TireCustodyProtocol"("tenantId", "setId");

CREATE UNIQUE INDEX "TireCustodySignature_protocolId_role_key" ON "TireCustodySignature"("protocolId", "role");
CREATE INDEX "TireCustodySignature_tenantId_protocolId_idx" ON "TireCustodySignature"("tenantId", "protocolId");

ALTER TABLE "TireCustodyProtocol" ADD CONSTRAINT "TireCustodyProtocol_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TireCustodyProtocol" ADD CONSTRAINT "TireCustodyProtocol_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "TireStorageStay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TireCustodyProtocol" ADD CONSTRAINT "TireCustodyProtocol_setId_fkey" FOREIGN KEY ("setId") REFERENCES "TireSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TireCustodyProtocol" ADD CONSTRAINT "TireCustodyProtocol_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TireCustodySignature" ADD CONSTRAINT "TireCustodySignature_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "TireCustodyProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;
