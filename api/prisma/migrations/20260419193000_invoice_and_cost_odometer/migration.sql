-- AlterTable
ALTER TABLE "MaintenanceEntry"
ADD COLUMN "invoiceNumber" TEXT,
ADD COLUMN "invoiceDate" TIMESTAMP(3),
ADD COLUMN "invoiceAttachmentUrl" TEXT;

-- AlterTable
ALTER TABLE "CostEntry"
ADD COLUMN "odometerKm" INTEGER,
ADD COLUMN "invoiceNumber" TEXT,
ADD COLUMN "invoiceDate" TIMESTAMP(3),
ADD COLUMN "invoiceAttachmentUrl" TEXT;
