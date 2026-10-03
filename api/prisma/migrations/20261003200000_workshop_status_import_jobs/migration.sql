-- WO atelier status (TV etc.)
ALTER TABLE "MaintenanceWorkOrder" ADD COLUMN IF NOT EXISTS "workshopStatusCode" TEXT;

-- CSV import job history
CREATE TYPE "ImportJobStatus" AS ENUM ('dry_run', 'completed', 'failed');

CREATE TABLE IF NOT EXISTS "ImportJob" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "entity" TEXT NOT NULL,
  "templateId" TEXT,
  "status" "ImportJobStatus" NOT NULL DEFAULT 'dry_run',
  "fileName" TEXT,
  "dryRun" BOOLEAN NOT NULL DEFAULT true,
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "successRows" INTEGER NOT NULL DEFAULT 0,
  "errorRows" INTEGER NOT NULL DEFAULT 0,
  "errorReport" JSONB,
  "summary" JSONB,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ImportJob_tenantId_createdAt_idx" ON "ImportJob"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "ImportJob_tenantId_entity_status_idx" ON "ImportJob"("tenantId", "entity", "status");

ALTER TABLE "ImportJob"
  ADD CONSTRAINT "ImportJob_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImportJob"
  ADD CONSTRAINT "ImportJob_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
