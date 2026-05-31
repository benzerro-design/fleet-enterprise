-- AlterTable
ALTER TABLE "VehicleDocument" ADD COLUMN "dueOdometerKm" INTEGER,
ADD COLUMN "reminderOffsetsKm" JSONB;

-- AlterTable
ALTER TABLE "MaintenanceEntry" ADD COLUMN "dueOdometerKm" INTEGER,
ADD COLUMN "reminderOffsetsKm" JSONB;

-- AlterTable
ALTER TABLE "CostEntry" ADD COLUMN "dueOdometerKm" INTEGER,
ADD COLUMN "reminderOffsetsKm" JSONB;
