-- Etape In service / Out service + timestamps pe comandă
ALTER TYPE "ServiceCaseStage" ADD VALUE IF NOT EXISTS 'in_service';
ALTER TYPE "ServiceCaseStage" ADD VALUE IF NOT EXISTS 'out_service';

ALTER TABLE "MaintenanceWorkOrder" ADD COLUMN IF NOT EXISTS "inServiceAt" TIMESTAMP(3);
ALTER TABLE "MaintenanceWorkOrder" ADD COLUMN IF NOT EXISTS "outServiceAt" TIMESTAMP(3);
