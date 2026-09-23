ALTER TABLE "User" ADD COLUMN "disabledAt" TIMESTAMP(3);

ALTER TABLE "Supplier" ADD COLUMN "integrationEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Supplier" ADD COLUMN "integrationKeyLast4" TEXT;

ALTER TABLE "WorkOrderQuote" ADD COLUMN "invoiceGrossCents" INTEGER;
ALTER TABLE "WorkOrderQuote" ADD COLUMN "invoiceMismatch" BOOLEAN NOT NULL DEFAULT false;

CREATE TYPE "WorkOrderPhotoKind" AS ENUM ('condition', 'defect');
CREATE TYPE "WorkOrderPhotoPhase" AS ENUM ('in', 'check', 'out', 'defect');

CREATE TABLE "WorkOrderPhoto" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "kind" "WorkOrderPhotoKind" NOT NULL,
    "phase" "WorkOrderPhotoPhase" NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderPhoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkOrderPhoto_workOrderId_kind_idx" ON "WorkOrderPhoto"("workOrderId", "kind");

ALTER TABLE "WorkOrderPhoto" ADD CONSTRAINT "WorkOrderPhoto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkOrderPhoto" ADD CONSTRAINT "WorkOrderPhoto_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "MaintenanceWorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
