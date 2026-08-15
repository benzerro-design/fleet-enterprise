-- Etapă reparație suplimentară pe WO (fără Tila 2 completă).
ALTER TABLE "MaintenanceWorkOrder" ADD COLUMN IF NOT EXISTS "supplementRepairAt" TIMESTAMP(3);
ALTER TABLE "MaintenanceWorkOrder" ADD COLUMN IF NOT EXISTS "supplementQuoteVersion" INTEGER;
