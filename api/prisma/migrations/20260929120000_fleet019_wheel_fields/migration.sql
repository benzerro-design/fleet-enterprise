-- FLEET-019: mărimi / model / indice viteză / C / tip jantă / prezoane
DO $$ BEGIN
  CREATE TYPE "VehicleRimMaterial" AS ENUM ('steel', 'alloy', 'diamond_cut');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "VehicleWheelFitment" ADD COLUMN IF NOT EXISTS "model" TEXT;
ALTER TABLE "VehicleWheelFitment" ADD COLUMN IF NOT EXISTS "speedIndex" TEXT;
ALTER TABLE "VehicleWheelFitment" ADD COLUMN IF NOT EXISTS "commercialC" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "VehicleWheelFitment" ADD COLUMN IF NOT EXISTS "rimMaterial" "VehicleRimMaterial";
ALTER TABLE "VehicleWheelFitment" ADD COLUMN IF NOT EXISTS "lugNutCount" INTEGER;
