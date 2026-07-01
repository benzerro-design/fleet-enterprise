-- CreateEnum
CREATE TYPE "ServiceAppointmentStatus" AS ENUM ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');

-- CreateEnum
CREATE TYPE "WorkOrderQuoteStatus" AS ENUM ('draft', 'submitted', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "WorkOrderQuoteLineType" AS ENUM ('labor', 'parts', 'other');

-- CreateTable
CREATE TABLE "ServiceAppointment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "serviceCaseId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "supplierId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "status" "ServiceAppointmentStatus" NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderQuote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "WorkOrderQuoteStatus" NOT NULL DEFAULT 'draft',
    "currency" TEXT NOT NULL DEFAULT 'RON',
    "totalNetCents" INTEGER NOT NULL DEFAULT 0,
    "totalVatCents" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrderQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderQuoteLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "lineType" "WorkOrderQuoteLineType" NOT NULL DEFAULT 'parts',
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitNetCents" INTEGER NOT NULL,
    "vatRatePercent" INTEGER NOT NULL DEFAULT 19,
    "partNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrderQuoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceAppointment_tenantId_idx" ON "ServiceAppointment"("tenantId");

-- CreateIndex
CREATE INDEX "ServiceAppointment_serviceCaseId_idx" ON "ServiceAppointment"("serviceCaseId");

-- CreateIndex
CREATE INDEX "ServiceAppointment_vehicleId_idx" ON "ServiceAppointment"("vehicleId");

-- CreateIndex
CREATE INDEX "ServiceAppointment_supplierId_idx" ON "ServiceAppointment"("supplierId");

-- CreateIndex
CREATE INDEX "ServiceAppointment_scheduledAt_idx" ON "ServiceAppointment"("scheduledAt");

-- CreateIndex
CREATE INDEX "WorkOrderQuote_tenantId_idx" ON "WorkOrderQuote"("tenantId");

-- CreateIndex
CREATE INDEX "WorkOrderQuote_workOrderId_idx" ON "WorkOrderQuote"("workOrderId");

-- CreateIndex
CREATE INDEX "WorkOrderQuote_workOrderId_status_idx" ON "WorkOrderQuote"("workOrderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrderQuote_workOrderId_version_key" ON "WorkOrderQuote"("workOrderId", "version");

-- CreateIndex
CREATE INDEX "WorkOrderQuoteLine_tenantId_idx" ON "WorkOrderQuoteLine"("tenantId");

-- CreateIndex
CREATE INDEX "WorkOrderQuoteLine_quoteId_idx" ON "WorkOrderQuoteLine"("quoteId");

-- AddForeignKey
ALTER TABLE "ServiceAppointment" ADD CONSTRAINT "ServiceAppointment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAppointment" ADD CONSTRAINT "ServiceAppointment_serviceCaseId_fkey" FOREIGN KEY ("serviceCaseId") REFERENCES "ServiceCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAppointment" ADD CONSTRAINT "ServiceAppointment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAppointment" ADD CONSTRAINT "ServiceAppointment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderQuote" ADD CONSTRAINT "WorkOrderQuote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderQuote" ADD CONSTRAINT "WorkOrderQuote_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "MaintenanceWorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderQuoteLine" ADD CONSTRAINT "WorkOrderQuoteLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderQuoteLine" ADD CONSTRAINT "WorkOrderQuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "WorkOrderQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
