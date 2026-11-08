-- F0.2: link CRM tickets to tire hotel stays
ALTER TYPE "CrmTicketLinkEntityType" ADD VALUE IF NOT EXISTS 'tire_storage_stay';

-- F0.5: concurrent ops lock on tire sets
ALTER TABLE "TireSet" ADD COLUMN IF NOT EXISTS "opsLockUntil" TIMESTAMP(3);
ALTER TABLE "TireSet" ADD COLUMN IF NOT EXISTS "opsLockByUserId" TEXT;
