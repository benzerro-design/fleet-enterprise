-- F5d: identificator uman WO + km la intrare/ieșire service
ALTER TABLE "MaintenanceWorkOrder" ADD COLUMN IF NOT EXISTS "displayNumber" TEXT;
ALTER TABLE "MaintenanceWorkOrder" ADD COLUMN IF NOT EXISTS "odometerKmIn" INTEGER;
ALTER TABLE "MaintenanceWorkOrder" ADD COLUMN IF NOT EXISTS "odometerKmOut" INTEGER;
ALTER TABLE "MaintenanceWorkOrder" ADD COLUMN IF NOT EXISTS "repairPathNote" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "MaintenanceWorkOrder_tenantId_displayNumber_key"
  ON "MaintenanceWorkOrder"("tenantId", "displayNumber")
  WHERE "displayNumber" IS NOT NULL;
