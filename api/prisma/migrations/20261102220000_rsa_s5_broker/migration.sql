-- RSA-S5: broker / 24×7 API pe profil + jurnal evenimente.

ALTER TABLE "RsaSupplierProfile" ADD COLUMN IF NOT EXISTS "brokerOutboundEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RsaSupplierProfile" ADD COLUMN IF NOT EXISTS "brokerApiBaseUrl" TEXT;
ALTER TABLE "RsaSupplierProfile" ADD COLUMN IF NOT EXISTS "brokerApiKeySealed" TEXT;
ALTER TABLE "RsaSupplierProfile" ADD COLUMN IF NOT EXISTS "brokerApiKeyLast4" TEXT;
ALTER TABLE "RsaSupplierProfile" ADD COLUMN IF NOT EXISTS "brokerInboundEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RsaSupplierProfile" ADD COLUMN IF NOT EXISTS "brokerInboundSecretHash" TEXT;
ALTER TABLE "RsaSupplierProfile" ADD COLUMN IF NOT EXISTS "brokerInboundSecretLast4" TEXT;
ALTER TABLE "RsaSupplierProfile" ADD COLUMN IF NOT EXISTS "brokerAutoDispatch" BOOLEAN NOT NULL DEFAULT false;

DO $$ BEGIN
  CREATE TYPE "RsaBrokerDirection" AS ENUM ('outbound', 'inbound');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "RsaBrokerEventStatus" AS ENUM ('pending', 'sent', 'accepted', 'failed', 'received', 'dry_run');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "RsaBrokerEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "profileId" TEXT,
  "interventionId" TEXT,
  "missionId" TEXT,
  "direction" "RsaBrokerDirection" NOT NULL,
  "eventType" TEXT NOT NULL,
  "status" "RsaBrokerEventStatus" NOT NULL DEFAULT 'pending',
  "externalRef" TEXT,
  "requestPayloadJson" JSONB,
  "responsePayloadJson" JSONB,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RsaBrokerEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RsaBrokerEvent_tenantId_createdAt_idx" ON "RsaBrokerEvent"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "RsaBrokerEvent_tenantId_supplierId_createdAt_idx" ON "RsaBrokerEvent"("tenantId", "supplierId", "createdAt");
CREATE INDEX IF NOT EXISTS "RsaBrokerEvent_interventionId_idx" ON "RsaBrokerEvent"("interventionId");
CREATE INDEX IF NOT EXISTS "RsaBrokerEvent_externalRef_idx" ON "RsaBrokerEvent"("externalRef");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RsaBrokerEvent_tenantId_fkey') THEN
    ALTER TABLE "RsaBrokerEvent"
      ADD CONSTRAINT "RsaBrokerEvent_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RsaBrokerEvent_profileId_fkey') THEN
    ALTER TABLE "RsaBrokerEvent"
      ADD CONSTRAINT "RsaBrokerEvent_profileId_fkey"
      FOREIGN KEY ("profileId") REFERENCES "RsaSupplierProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
