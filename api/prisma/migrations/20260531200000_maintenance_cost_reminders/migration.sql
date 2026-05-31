-- AlterEnum
ALTER TYPE "ReminderSourceType" ADD VALUE 'cost';

-- AlterTable
ALTER TABLE "MaintenanceEntry" ADD COLUMN "nextDueOn" TIMESTAMP(3),
ADD COLUMN "reminderOffsetsDays" JSONB;

-- AlterTable
ALTER TABLE "CostEntry" ADD COLUMN "nextDueOn" TIMESTAMP(3),
ADD COLUMN "reminderOffsetsDays" JSONB;

-- AlterTable
ALTER TABLE "ReminderAction" ADD COLUMN "costEntryId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ReminderAction_costEntryId_key" ON "ReminderAction"("costEntryId");

-- AddForeignKey
ALTER TABLE "ReminderAction" ADD CONSTRAINT "ReminderAction_costEntryId_fkey" FOREIGN KEY ("costEntryId") REFERENCES "CostEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
