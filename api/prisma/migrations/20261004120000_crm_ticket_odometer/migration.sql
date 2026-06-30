-- AlterEnum
ALTER TYPE "CrmTicketEventKind" ADD VALUE 'odometer';

-- AlterTable
ALTER TABLE "CrmTicket" ADD COLUMN "eventOdometerKm" INTEGER;
