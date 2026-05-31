-- AlterTable
ALTER TABLE "VehicleDocument" ADD COLUMN "reminderMenuSyncEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "MaintenanceEntry" ADD COLUMN "reminderMenuSyncEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "CostEntry" ADD COLUMN "reminderMenuSyncEnabled" BOOLEAN NOT NULL DEFAULT true;
