-- Overlay tarife hotel pe alocare client↔furnizor
ALTER TABLE "ClientSupplierAllocation" ADD COLUMN IF NOT EXISTS "tireStorageFeeTyreOnlyCents" INTEGER;
ALTER TABLE "ClientSupplierAllocation" ADD COLUMN IF NOT EXISTS "tireStorageFeeOnRimCents" INTEGER;
ALTER TABLE "ClientSupplierAllocation" ADD COLUMN IF NOT EXISTS "tireStorageFeeBands" JSONB;
