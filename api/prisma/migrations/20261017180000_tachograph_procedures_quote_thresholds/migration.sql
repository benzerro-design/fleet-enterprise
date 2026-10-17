ALTER TABLE "Tenant" ADD COLUMN "quoteApprovalSettings" JSONB;

CREATE TYPE "ProcedureStatus" AS ENUM ('draft', 'published', 'withdrawn');

CREATE TABLE "TachographDay" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "drivingMinutes" INTEGER NOT NULL DEFAULT 0,
    "otherWorkMinutes" INTEGER NOT NULL DEFAULT 0,
    "availabilityMinutes" INTEGER NOT NULL DEFAULT 0,
    "restMinutes" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TachographDay_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkProcedure" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ProcedureStatus" NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "steps" JSONB NOT NULL,
    "screenPath" TEXT,
    "ownerUserId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkProcedure_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TachographDay_tenantId_vehicleId_driverId_day_key" ON "TachographDay"("tenantId", "vehicleId", "driverId", "day");
CREATE INDEX "TachographDay_tenantId_day_idx" ON "TachographDay"("tenantId", "day");
CREATE INDEX "TachographDay_vehicleId_idx" ON "TachographDay"("vehicleId");
CREATE INDEX "TachographDay_driverId_idx" ON "TachographDay"("driverId");
CREATE INDEX "WorkProcedure_tenantId_status_idx" ON "WorkProcedure"("tenantId", "status");

ALTER TABLE "TachographDay" ADD CONSTRAINT "TachographDay_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TachographDay" ADD CONSTRAINT "TachographDay_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TachographDay" ADD CONSTRAINT "TachographDay_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkProcedure" ADD CONSTRAINT "WorkProcedure_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
