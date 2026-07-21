CREATE TYPE "WorkOrderQuoteLineApproval" AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE "QuotePartsOrderStatus" AS ENUM ('none', 'ordered', 'in_stock', 'delivered');
CREATE TYPE "WorkOrderWarrantyStatus" AS ENUM ('draft', 'active', 'locked');

ALTER TABLE "WorkOrderQuote"
  ADD COLUMN "approvedNetCents" INTEGER,
  ADD COLUMN "approvedVatCents" INTEGER;

ALTER TABLE "WorkOrderQuoteLine"
  ADD COLUMN "approvalStatus" "WorkOrderQuoteLineApproval" NOT NULL DEFAULT 'pending',
  ADD COLUMN "partCodeExempt" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "partsOrderStatus" "QuotePartsOrderStatus" NOT NULL DEFAULT 'none',
  ADD COLUMN "partsExpectedOn" TIMESTAMP(3),
  ADD COLUMN "warrantyMonths" INTEGER,
  ADD COLUMN "warrantyKm" INTEGER;

ALTER TABLE "MaintenanceWorkOrder"
  ADD COLUMN "visit2InServiceAt" TIMESTAMP(3),
  ADD COLUMN "visit2OutServiceAt" TIMESTAMP(3),
  ADD COLUMN "visit2OdometerKmIn" INTEGER,
  ADD COLUMN "visit2OdometerKmOut" INTEGER;

ALTER TABLE "MaintenanceEntry"
  ADD COLUMN "sourceCostEntryId" TEXT;

CREATE TABLE "WorkOrderWarranty" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "workOrderId" TEXT NOT NULL,
  "sourceQuoteId" TEXT,
  "status" "WorkOrderWarrantyStatus" NOT NULL DEFAULT 'draft',
  "startsAt" TIMESTAMP(3),
  "startsKm" INTEGER,
  "conditionsPdfUrl" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkOrderWarranty_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkOrderWarrantyLine" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "warrantyId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "sourceQuoteLineId" TEXT,
  "lineType" "WorkOrderQuoteLineType" NOT NULL,
  "description" TEXT NOT NULL,
  "partNumber" TEXT,
  "warrantyMonths" INTEGER NOT NULL,
  "warrantyKm" INTEGER,

  CONSTRAINT "WorkOrderWarrantyLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkOrderWarranty_workOrderId_key" ON "WorkOrderWarranty"("workOrderId");
CREATE INDEX "WorkOrderWarranty_tenantId_idx" ON "WorkOrderWarranty"("tenantId");
CREATE INDEX "WorkOrderWarranty_workOrderId_idx" ON "WorkOrderWarranty"("workOrderId");
CREATE INDEX "WorkOrderWarrantyLine_tenantId_idx" ON "WorkOrderWarrantyLine"("tenantId");
CREATE INDEX "WorkOrderWarrantyLine_warrantyId_idx" ON "WorkOrderWarrantyLine"("warrantyId");
CREATE INDEX "WorkOrderWarrantyLine_sourceQuoteLineId_idx" ON "WorkOrderWarrantyLine"("sourceQuoteLineId");
CREATE UNIQUE INDEX "MaintenanceEntry_sourceCostEntryId_key" ON "MaintenanceEntry"("sourceCostEntryId");

ALTER TABLE "MaintenanceEntry"
  ADD CONSTRAINT "MaintenanceEntry_sourceCostEntryId_fkey"
  FOREIGN KEY ("sourceCostEntryId") REFERENCES "CostEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkOrderWarranty"
  ADD CONSTRAINT "WorkOrderWarranty_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkOrderWarranty"
  ADD CONSTRAINT "WorkOrderWarranty_workOrderId_fkey"
  FOREIGN KEY ("workOrderId") REFERENCES "MaintenanceWorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkOrderWarrantyLine"
  ADD CONSTRAINT "WorkOrderWarrantyLine_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkOrderWarrantyLine"
  ADD CONSTRAINT "WorkOrderWarrantyLine_warrantyId_fkey"
  FOREIGN KEY ("warrantyId") REFERENCES "WorkOrderWarranty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkOrderWarrantyLine"
  ADD CONSTRAINT "WorkOrderWarrantyLine_sourceQuoteLineId_fkey"
  FOREIGN KEY ("sourceQuoteLineId") REFERENCES "WorkOrderQuoteLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
