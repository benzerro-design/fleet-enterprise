-- FLEET-007: grilă tarife hotel pe diametru jantă
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "tireStorageFeeBands" JSONB;
