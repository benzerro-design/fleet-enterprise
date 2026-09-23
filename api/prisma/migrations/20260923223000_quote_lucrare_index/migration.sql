-- Lucrare track pe Deviz + snapshot readyAt pentru Tila Lucrare #1 înghețat
ALTER TABLE "WorkOrderQuote" ADD COLUMN IF NOT EXISTS "lucrareIndex" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "MaintenanceWorkOrder" ADD COLUMN IF NOT EXISTS "lucrare1ReadyAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "WorkOrderQuote_workOrderId_lucrareIndex_idx"
  ON "WorkOrderQuote"("workOrderId", "lucrareIndex");

-- Backfill: Devizele de la versiunea supliment în sus → Lucrare #2
UPDATE "WorkOrderQuote" q
SET "lucrareIndex" = 2
FROM "MaintenanceWorkOrder" w
WHERE q."workOrderId" = w.id
  AND w."supplementQuoteVersion" IS NOT NULL
  AND q.version >= w."supplementQuoteVersion"
  AND q."lucrareIndex" = 1;

-- Snapshot L1: dacă L2 a fost deschisă și nu avem încă readyAt înghețat, folosim momentul L2
UPDATE "MaintenanceWorkOrder"
SET "lucrare1ReadyAt" = "supplementRepairAt"
WHERE "supplementRepairAt" IS NOT NULL
  AND "lucrare1ReadyAt" IS NULL;
