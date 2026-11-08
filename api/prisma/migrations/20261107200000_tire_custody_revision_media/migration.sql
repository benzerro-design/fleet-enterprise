-- FLEET-007 Build #1c: versioned rectification + protocol media

CREATE TYPE "TireCustodyMediaKind" AS ENUM ('intake', 'condition', 'label', 'other');

ALTER TABLE "TireCustodyProtocol" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;

DROP INDEX IF EXISTS "TireCustodyProtocol_stayId_kind_key";
CREATE UNIQUE INDEX "TireCustodyProtocol_stayId_kind_revision_key" ON "TireCustodyProtocol"("stayId", "kind", "revision");
CREATE INDEX "TireCustodyProtocol_tenantId_stayId_kind_status_idx" ON "TireCustodyProtocol"("tenantId", "stayId", "kind", "status");

CREATE TABLE "TireCustodyMedia" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "kind" "TireCustodyMediaKind" NOT NULL DEFAULT 'other',
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "caption" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TireCustodyMedia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TireCustodyMedia_protocolId_idx" ON "TireCustodyMedia"("protocolId");
CREATE INDEX "TireCustodyMedia_tenantId_protocolId_idx" ON "TireCustodyMedia"("tenantId", "protocolId");

ALTER TABLE "TireCustodyMedia" ADD CONSTRAINT "TireCustodyMedia_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "TireCustodyProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;
