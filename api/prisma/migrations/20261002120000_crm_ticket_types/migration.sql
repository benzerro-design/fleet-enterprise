-- CreateEnum
CREATE TYPE "CrmTicketType" AS ENUM ('itp', 'damage', 'maintenance', 'document', 'transport', 'technical', 'other');

-- AlterTable
ALTER TABLE "CrmTicket" ADD COLUMN "ticketType" "CrmTicketType" NOT NULL DEFAULT 'other';

-- CreateIndex
CREATE INDEX "CrmTicket_ticketType_idx" ON "CrmTicket"("ticketType");
