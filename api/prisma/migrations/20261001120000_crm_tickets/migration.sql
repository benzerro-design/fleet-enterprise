-- CreateEnum
CREATE TYPE "CrmTicketStatus" AS ENUM ('open', 'in_progress', 'resolved', 'cancelled');

-- CreateEnum
CREATE TYPE "CrmTicketPriority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "CrmTicketRoutingLevel" AS ENUM ('L0', 'L1', 'L1N', 'L_STAR');

-- CreateEnum
CREATE TYPE "CrmTicketEventKind" AS ENUM ('comment', 'routing', 'transform', 'status');

-- CreateEnum
CREATE TYPE "CrmTicketLinkEntityType" AS ENUM ('maintenance', 'cost', 'trip', 'reminder', 'document');

-- CreateTable
CREATE TABLE "CrmTicket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "status" "CrmTicketStatus" NOT NULL DEFAULT 'open',
    "priority" "CrmTicketPriority" NOT NULL DEFAULT 'normal',
    "routingLevel" "CrmTicketRoutingLevel" NOT NULL DEFAULT 'L1',
    "assignedQueue" TEXT NOT NULL,
    "vehicleId" TEXT,
    "driverId" TEXT,
    "reminderActionId" TEXT,
    "createdByUserId" TEXT,
    "ownerUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmTicketEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "kind" "CrmTicketEventKind" NOT NULL,
    "body" TEXT,
    "payload" JSONB,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmTicketEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmTicketLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "entityType" "CrmTicketLinkEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmTicketLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmTicket_tenantId_idx" ON "CrmTicket"("tenantId");

-- CreateIndex
CREATE INDEX "CrmTicket_clientId_idx" ON "CrmTicket"("clientId");

-- CreateIndex
CREATE INDEX "CrmTicket_tenantId_status_idx" ON "CrmTicket"("tenantId", "status");

-- CreateIndex
CREATE INDEX "CrmTicket_vehicleId_idx" ON "CrmTicket"("vehicleId");

-- CreateIndex
CREATE INDEX "CrmTicket_reminderActionId_idx" ON "CrmTicket"("reminderActionId");

-- CreateIndex
CREATE INDEX "CrmTicket_routingLevel_idx" ON "CrmTicket"("routingLevel");

-- CreateIndex
CREATE INDEX "CrmTicket_assignedQueue_idx" ON "CrmTicket"("assignedQueue");

-- CreateIndex
CREATE INDEX "CrmTicketEvent_tenantId_idx" ON "CrmTicketEvent"("tenantId");

-- CreateIndex
CREATE INDEX "CrmTicketEvent_ticketId_createdAt_idx" ON "CrmTicketEvent"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "CrmTicketLink_tenantId_idx" ON "CrmTicketLink"("tenantId");

-- CreateIndex
CREATE INDEX "CrmTicketLink_ticketId_idx" ON "CrmTicketLink"("ticketId");

-- CreateIndex
CREATE INDEX "CrmTicketLink_entityType_entityId_idx" ON "CrmTicketLink"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "CrmTicket" ADD CONSTRAINT "CrmTicket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTicket" ADD CONSTRAINT "CrmTicket_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTicket" ADD CONSTRAINT "CrmTicket_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTicket" ADD CONSTRAINT "CrmTicket_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTicket" ADD CONSTRAINT "CrmTicket_reminderActionId_fkey" FOREIGN KEY ("reminderActionId") REFERENCES "ReminderAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTicket" ADD CONSTRAINT "CrmTicket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTicket" ADD CONSTRAINT "CrmTicket_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTicketEvent" ADD CONSTRAINT "CrmTicketEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTicketEvent" ADD CONSTRAINT "CrmTicketEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "CrmTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTicketEvent" ADD CONSTRAINT "CrmTicketEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTicketLink" ADD CONSTRAINT "CrmTicketLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTicketLink" ADD CONSTRAINT "CrmTicketLink_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "CrmTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
