-- CreateEnum
CREATE TYPE "MaintenancePlanTriggerMode" AS ENUM ('time', 'km', 'whichever_first');

-- AlterEnum
ALTER TYPE "ReminderSourceType" ADD VALUE 'maintenance_plan';

-- CreateTable
CREATE TABLE "MaintenancePlanItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "intervalDays" INTEGER,
    "intervalKm" INTEGER,
    "triggerMode" "MaintenancePlanTriggerMode" NOT NULL DEFAULT 'whichever_first',
    "lastServiceOn" TIMESTAMP(3),
    "lastServiceKm" INTEGER,
    "nextDueOn" TIMESTAMP(3),
    "dueOdometerKm" INTEGER,
    "dueManualOverride" BOOLEAN NOT NULL DEFAULT false,
    "reminderOffsetsDays" JSONB,
    "reminderOffsetsKm" JSONB,
    "reminderMenuSyncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "preferredProvider" TEXT,
    "estimatedCostCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenancePlanItem_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ReminderAction" ADD COLUMN "maintenancePlanItemId" TEXT;

-- CreateIndex
CREATE INDEX "MaintenancePlanItem_tenantId_idx" ON "MaintenancePlanItem"("tenantId");
CREATE INDEX "MaintenancePlanItem_vehicleId_idx" ON "MaintenancePlanItem"("vehicleId");
CREATE INDEX "MaintenancePlanItem_vehicleId_sortOrder_idx" ON "MaintenancePlanItem"("vehicleId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderAction_maintenancePlanItemId_key" ON "ReminderAction"("maintenancePlanItemId");

-- AddForeignKey
ALTER TABLE "MaintenancePlanItem" ADD CONSTRAINT "MaintenancePlanItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenancePlanItem" ADD CONSTRAINT "MaintenancePlanItem_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReminderAction" ADD CONSTRAINT "ReminderAction_maintenancePlanItemId_fkey" FOREIGN KEY ("maintenancePlanItemId") REFERENCES "MaintenancePlanItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
