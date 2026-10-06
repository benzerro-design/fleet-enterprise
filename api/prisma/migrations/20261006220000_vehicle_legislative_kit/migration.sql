-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "legislativeKit" JSONB;

-- AlterEnum VehiclePhotoKind
ALTER TYPE "VehiclePhotoKind" ADD VALUE IF NOT EXISTS 'kit_extinguisher';
ALTER TYPE "VehiclePhotoKind" ADD VALUE IF NOT EXISTS 'kit_medical';
ALTER TYPE "VehiclePhotoKind" ADD VALUE IF NOT EXISTS 'kit_puncture';
ALTER TYPE "VehiclePhotoKind" ADD VALUE IF NOT EXISTS 'kit_triangle';
ALTER TYPE "VehiclePhotoKind" ADD VALUE IF NOT EXISTS 'kit_vest';
