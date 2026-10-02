-- SCHED-004: capacitate concomitentă pe furnizor
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "slotCapacity" INTEGER NOT NULL DEFAULT 1;
