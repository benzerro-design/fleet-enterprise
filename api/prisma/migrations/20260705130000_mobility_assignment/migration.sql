-- CreateEnum
CREATE TYPE "MobilityAssignmentStatus" AS ENUM ('draft', 'eligible', 'reserved', 'active', 'returned', 'waived', 'cancelled');

-- CreateEnum
CREATE TYPE "MobilityDeliveryMode" AS ENUM ('customer_pickup', 'delivered_to_customer', 'at_supplier');

-- AlterEnum
ALTER TYPE "CrmTicketEventKind" ADD VALUE 'mobility_update';

-- CreateTable
CREATE TABLE "MobilityAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "displayNumber" TEXT,
    "workOrderId" TEXT NOT NULL,
    "serviceCaseId" TEXT NOT NULL,
    "sourceTicketId" TEXT,
    "clientId" TEXT NOT NULL,
    "coveredVehicleId" TEXT NOT NULL,
    "coveredVehicleRegSnapshot" TEXT,
    "supplierId" TEXT,
    "replacementRegistration" TEXT,
    "status" "MobilityAssignmentStatus" NOT NULL DEFAULT 'draft',
    "eligibilityHours" INTEGER,
    "eligibilityTriggeredAt" TIMESTAMP(3),
    "handoverAt" TIMESTAMP(3),
    "expectedReturnAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "deliveryMode" "MobilityDeliveryMode",
    "handoverUserLabel" TEXT,
    "waivedReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobilityAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MobilityAssignment_tenantId_idx" ON "MobilityAssignment"("tenantId");

-- CreateIndex
CREATE INDEX "MobilityAssignment_workOrderId_idx" ON "MobilityAssignment"("workOrderId");

-- CreateIndex
CREATE INDEX "MobilityAssignment_serviceCaseId_idx" ON "MobilityAssignment"("serviceCaseId");

-- CreateIndex
CREATE INDEX "MobilityAssignment_sourceTicketId_idx" ON "MobilityAssignment"("sourceTicketId");

-- CreateIndex
CREATE INDEX "MobilityAssignment_tenantId_status_idx" ON "MobilityAssignment"("tenantId", "status");

-- CreateIndex
CREATE INDEX "MobilityAssignment_coveredVehicleId_idx" ON "MobilityAssignment"("coveredVehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "MobilityAssignment_tenantId_displayNumber_key" ON "MobilityAssignment"("tenantId", "displayNumber");

-- AddForeignKey
ALTER TABLE "MobilityAssignment" ADD CONSTRAINT "MobilityAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobilityAssignment" ADD CONSTRAINT "MobilityAssignment_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "MaintenanceWorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobilityAssignment" ADD CONSTRAINT "MobilityAssignment_serviceCaseId_fkey" FOREIGN KEY ("serviceCaseId") REFERENCES "ServiceCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobilityAssignment" ADD CONSTRAINT "MobilityAssignment_sourceTicketId_fkey" FOREIGN KEY ("sourceTicketId") REFERENCES "CrmTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobilityAssignment" ADD CONSTRAINT "MobilityAssignment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobilityAssignment" ADD CONSTRAINT "MobilityAssignment_coveredVehicleId_fkey" FOREIGN KEY ("coveredVehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobilityAssignment" ADD CONSTRAINT "MobilityAssignment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
