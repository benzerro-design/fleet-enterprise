-- CRM-010: SLA settings + ticket timers
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "slaSettings" JSONB;
ALTER TABLE "CrmTicket" ADD COLUMN IF NOT EXISTS "firstResponseDueAt" TIMESTAMP(3);
ALTER TABLE "CrmTicket" ADD COLUMN IF NOT EXISTS "resolveDueAt" TIMESTAMP(3);
ALTER TABLE "CrmTicket" ADD COLUMN IF NOT EXISTS "firstRespondedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "CrmTicket_tenantId_firstResponseDueAt_idx" ON "CrmTicket"("tenantId", "firstResponseDueAt");
CREATE INDEX IF NOT EXISTS "CrmTicket_tenantId_resolveDueAt_idx" ON "CrmTicket"("tenantId", "resolveDueAt");

-- PARTNER-002: IBAN pe furnizor
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "iban" TEXT;

-- FLEET-019: fitment roti pe vehicul
DO $$ BEGIN
  CREATE TYPE "VehicleWheelPosition" AS ENUM ('fl', 'fr', 'rl', 'rr', 'spare');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "VehicleTireSeason" AS ENUM ('summer', 'winter', 'all_season', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "VehicleWheelFitment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "position" "VehicleWheelPosition" NOT NULL,
    "size" TEXT,
    "brand" TEXT,
    "season" "VehicleTireSeason" NOT NULL DEFAULT 'unknown',
    "dot" TEXT,
    "treadMm" DOUBLE PRECISION,
    "rimSize" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VehicleWheelFitment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VehicleWheelFitment_vehicleId_position_key" ON "VehicleWheelFitment"("vehicleId", "position");
CREATE INDEX IF NOT EXISTS "VehicleWheelFitment_tenantId_idx" ON "VehicleWheelFitment"("tenantId");
CREATE INDEX IF NOT EXISTS "VehicleWheelFitment_vehicleId_idx" ON "VehicleWheelFitment"("vehicleId");

DO $$ BEGIN
  ALTER TABLE "VehicleWheelFitment" ADD CONSTRAINT "VehicleWheelFitment_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "VehicleWheelFitment" ADD CONSTRAINT "VehicleWheelFitment_vehicleId_fkey"
    FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
