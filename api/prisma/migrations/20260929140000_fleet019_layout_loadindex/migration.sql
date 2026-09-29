-- FLEET-019: loadIndex, wheelLayout, poziții duale spate
DO $$ BEGIN
  CREATE TYPE "VehicleWheelLayout" AS ENUM ('four', 'six_dual_rear');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "wheelLayout" "VehicleWheelLayout" NOT NULL DEFAULT 'four';

ALTER TABLE "VehicleWheelFitment" ADD COLUMN IF NOT EXISTS "loadIndex" TEXT;

-- Expand VehicleWheelPosition (additive; cannot run in same txn as usage on some PG versions — Prisma wraps OK for ADD VALUE on PG 12+)
DO $$ BEGIN
  ALTER TYPE "VehicleWheelPosition" ADD VALUE 'rlo';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "VehicleWheelPosition" ADD VALUE 'rli';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "VehicleWheelPosition" ADD VALUE 'rro';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "VehicleWheelPosition" ADD VALUE 'rri';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
