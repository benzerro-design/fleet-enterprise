-- Pachet 1.2 — legătură sejur hotel → locație depozit structurată

ALTER TABLE "TireStorageStay" ADD COLUMN IF NOT EXISTS "warehouseLocationId" TEXT;

CREATE INDEX IF NOT EXISTS "TireStorageStay_warehouseLocationId_idx" ON "TireStorageStay"("warehouseLocationId");

ALTER TABLE "TireStorageStay" ADD CONSTRAINT "TireStorageStay_warehouseLocationId_fkey"
  FOREIGN KEY ("warehouseLocationId") REFERENCES "TireWarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
