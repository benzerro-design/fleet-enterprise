-- AlterTable
ALTER TABLE "VehicleDocument" ADD COLUMN IF NOT EXISTS "fileUrlVerso" TEXT;
ALTER TABLE "VehicleDocument" ADD COLUMN IF NOT EXISTS "fileNameVerso" TEXT;
