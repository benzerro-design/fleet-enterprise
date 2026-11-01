-- FLEET-007: tarife hotel depozitare anvelope / roți pe furnizor
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "tireStorageFeeTyreOnlyCents" INTEGER;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "tireStorageFeeOnRimCents" INTEGER;
