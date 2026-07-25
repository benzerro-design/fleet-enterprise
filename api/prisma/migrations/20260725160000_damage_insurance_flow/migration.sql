-- CreateEnum
CREATE TYPE "VehicleMovableState" AS ENUM ('movable', 'immovable');

-- CreateEnum
CREATE TYPE "DamagePayerType" AS ENUM ('insurer', 'client');

-- CreateEnum
CREATE TYPE "DamageInsurerPipelineStatus" AS ENUM (
  'docs_pending',
  'ready_to_notify',
  'notified',
  'inspection_note',
  'reinspection_requested',
  'quote_ready',
  'payment_accepted'
);

-- AlterTable CrmTicket
ALTER TABLE "CrmTicket" ADD COLUMN "vehicleMovable" "VehicleMovableState";

-- AlterTable ServiceCase
ALTER TABLE "ServiceCase" ADD COLUMN "vehicleMovable" "VehicleMovableState",
ADD COLUMN "damagePayerType" "DamagePayerType",
ADD COLUMN "damageInsurerPipelineStatus" "DamageInsurerPipelineStatus",
ADD COLUMN "damagePhotosJson" JSONB,
ADD COLUMN "damageSectionLocksJson" JSONB;
