-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('active', 'inactive', 'blocked');
CREATE TYPE "SupplierCategory" AS ENUM ('service_auto', 'itp', 'fuel', 'tires', 'insurer', 'broker', 'dealer', 'other');
CREATE TYPE "ServiceCaseWorkflowType" AS ENUM ('repair', 'damage', 'itp', 'tires', 'insurance_rca', 'insurance_casco');
CREATE TYPE "ServiceCaseSourceType" AS ENUM ('ticket', 'reminder', 'direct');
CREATE TYPE "ServiceCaseStage" AS ENUM ('intake', 'scheduled', 'work_order', 'quote', 'approval', 'cost', 'invoiced', 'closed');
CREATE TYPE "ServiceCaseStatus" AS ENUM ('active', 'on_hold', 'completed', 'cancelled');
CREATE TYPE "MaintenanceWorkOrderStatus" AS ENUM ('draft', 'sent', 'in_progress', 'waiting_parts', 'done', 'cancelled');

-- AlterEnum
ALTER TYPE "CrmTicketEventKind" ADD VALUE 'workflow_advance';
ALTER TYPE "CrmTicketLinkEntityType" ADD VALUE 'service_case';
ALTER TYPE "CrmTicketLinkEntityType" ADD VALUE 'work_order';

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "taxId" TEXT,
    "category" "SupplierCategory" NOT NULL DEFAULT 'other',
    "status" "SupplierStatus" NOT NULL DEFAULT 'active',
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "county" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceCase" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "workflowType" "ServiceCaseWorkflowType" NOT NULL,
    "sourceType" "ServiceCaseSourceType" NOT NULL,
    "sourceTicketId" TEXT,
    "sourceReminderActionId" TEXT,
    "currentStage" "ServiceCaseStage" NOT NULL DEFAULT 'intake',
    "status" "ServiceCaseStatus" NOT NULL DEFAULT 'active',
    "supplierId" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MaintenanceWorkOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "serviceCaseId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "supplierId" TEXT,
    "title" TEXT NOT NULL,
    "status" "MaintenanceWorkOrderStatus" NOT NULL DEFAULT 'draft',
    "plannedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceWorkOrder_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "MaintenanceEntry" ADD COLUMN "supplierId" TEXT;
ALTER TABLE "CostEntry" ADD COLUMN "supplierId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_tenantId_code_key" ON "Supplier"("tenantId", "code");
CREATE INDEX "Supplier_tenantId_idx" ON "Supplier"("tenantId");
CREATE INDEX "Supplier_tenantId_status_idx" ON "Supplier"("tenantId", "status");
CREATE INDEX "Supplier_tenantId_category_idx" ON "Supplier"("tenantId", "category");

CREATE UNIQUE INDEX "ServiceCase_sourceTicketId_key" ON "ServiceCase"("sourceTicketId");
CREATE INDEX "ServiceCase_tenantId_idx" ON "ServiceCase"("tenantId");
CREATE INDEX "ServiceCase_clientId_idx" ON "ServiceCase"("clientId");
CREATE INDEX "ServiceCase_vehicleId_idx" ON "ServiceCase"("vehicleId");
CREATE INDEX "ServiceCase_sourceTicketId_idx" ON "ServiceCase"("sourceTicketId");
CREATE INDEX "ServiceCase_tenantId_status_idx" ON "ServiceCase"("tenantId", "status");
CREATE INDEX "ServiceCase_tenantId_currentStage_idx" ON "ServiceCase"("tenantId", "currentStage");

CREATE INDEX "MaintenanceWorkOrder_tenantId_idx" ON "MaintenanceWorkOrder"("tenantId");
CREATE INDEX "MaintenanceWorkOrder_serviceCaseId_idx" ON "MaintenanceWorkOrder"("serviceCaseId");
CREATE INDEX "MaintenanceWorkOrder_vehicleId_idx" ON "MaintenanceWorkOrder"("vehicleId");
CREATE INDEX "MaintenanceWorkOrder_supplierId_idx" ON "MaintenanceWorkOrder"("supplierId");

CREATE INDEX "MaintenanceEntry_supplierId_idx" ON "MaintenanceEntry"("supplierId");
CREATE INDEX "CostEntry_supplierId_idx" ON "CostEntry"("supplierId");

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceCase" ADD CONSTRAINT "ServiceCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceCase" ADD CONSTRAINT "ServiceCase_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceCase" ADD CONSTRAINT "ServiceCase_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceCase" ADD CONSTRAINT "ServiceCase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceCase" ADD CONSTRAINT "ServiceCase_sourceTicketId_fkey" FOREIGN KEY ("sourceTicketId") REFERENCES "CrmTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MaintenanceWorkOrder" ADD CONSTRAINT "MaintenanceWorkOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceWorkOrder" ADD CONSTRAINT "MaintenanceWorkOrder_serviceCaseId_fkey" FOREIGN KEY ("serviceCaseId") REFERENCES "ServiceCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceWorkOrder" ADD CONSTRAINT "MaintenanceWorkOrder_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaintenanceWorkOrder" ADD CONSTRAINT "MaintenanceWorkOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MaintenanceEntry" ADD CONSTRAINT "MaintenanceEntry_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CostEntry" ADD CONSTRAINT "CostEntry_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
