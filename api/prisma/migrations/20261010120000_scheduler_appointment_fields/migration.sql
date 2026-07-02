-- AlterTable
ALTER TABLE "ServiceAppointment" ADD COLUMN "title" TEXT,
ADD COLUMN "durationMin" INTEGER NOT NULL DEFAULT 60;

-- Backfill titles from service cases
UPDATE "ServiceAppointment" sa
SET "title" = sc."title"
FROM "ServiceCase" sc
WHERE sa."serviceCaseId" = sc."id" AND sa."title" IS NULL;
