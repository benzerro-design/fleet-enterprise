-- FELIA F4.1 — legătură stay hotel ↔ comandă R (tyre-close auto check-in)

ALTER TABLE "TireStorageStay" ADD COLUMN IF NOT EXISTS "workOrderId" TEXT;

CREATE INDEX IF NOT EXISTS "TireStorageStay_workOrderId_idx" ON "TireStorageStay"("workOrderId");

ALTER TABLE "TireStorageStay" ADD CONSTRAINT "TireStorageStay_workOrderId_fkey"
  FOREIGN KEY ("workOrderId") REFERENCES "MaintenanceWorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
