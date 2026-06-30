-- AlterTable
ALTER TABLE "CrmTicketEvent" ADD COLUMN "parentEventId" TEXT,
ADD COLUMN "editedAt" TIMESTAMP(3);

-- CreateEnum
CREATE TYPE "CrmTicketNotificationKind" AS ENUM ('mention');

-- CreateTable
CREATE TABLE "CrmTicketNotification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "eventId" TEXT,
    "kind" "CrmTicketNotificationKind" NOT NULL DEFAULT 'mention',
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmTicketNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmTicketEvent_parentEventId_idx" ON "CrmTicketEvent"("parentEventId");

-- CreateIndex
CREATE INDEX "CrmTicketNotification_userId_readAt_idx" ON "CrmTicketNotification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "CrmTicketNotification_tenantId_idx" ON "CrmTicketNotification"("tenantId");

-- CreateIndex
CREATE INDEX "CrmTicketNotification_ticketId_idx" ON "CrmTicketNotification"("ticketId");

-- AddForeignKey
ALTER TABLE "CrmTicketEvent" ADD CONSTRAINT "CrmTicketEvent_parentEventId_fkey" FOREIGN KEY ("parentEventId") REFERENCES "CrmTicketEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTicketNotification" ADD CONSTRAINT "CrmTicketNotification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTicketNotification" ADD CONSTRAINT "CrmTicketNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTicketNotification" ADD CONSTRAINT "CrmTicketNotification_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "CrmTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
