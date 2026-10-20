-- FLEET-007: at most one open (checkOutAt IS NULL) storage stay per tire set.
CREATE UNIQUE INDEX IF NOT EXISTS "TireStorageStay_set_open_uidx"
ON "TireStorageStay" ("setId") WHERE "checkOutAt" IS NULL;
