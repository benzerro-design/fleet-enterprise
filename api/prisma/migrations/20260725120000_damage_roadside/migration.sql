-- CreateEnum
CREATE TYPE "DamageInsuranceType" AS ENUM ('RCA', 'CASCO', 'BOTH', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DamageClaimStatus" AS ENUM ('open', 'documents_pending', 'insurer_review', 'agreed', 'rejected', 'closed');

-- CreateEnum
CREATE TYPE "RoadsideInterventionKind" AS ENUM ('tow', 'jump_start', 'tire_change', 'lockout', 'fuel_delivery', 'other');

-- CreateEnum
CREATE TYPE "RoadsideInterventionStatus" AS ENUM ('draft', 'requested', 'dispatched', 'on_site', 'completed', 'cancelled');

-- AlterEnum
ALTER TYPE "CrmTicketEventKind" ADD VALUE IF NOT EXISTS 'roadside_update';
ALTER TYPE "CrmTicketEventKind" ADD VALUE IF NOT EXISTS 'damage_claim_update';

-- AlterTable
ALTER TABLE "ServiceCase" ADD COLUMN "damageInsuranceType" "DamageInsuranceType",
ADD COLUMN "damageClaimNumber" TEXT,
ADD COLUMN "damageInsurerName" TEXT,
ADD COLUMN "damageClaimStatus" "DamageClaimStatus",
ADD COLUMN "damageInsurerAgreedAt" TIMESTAMP(3),
ADD COLUMN "damageInsurerAgreedByUserId" TEXT,
ADD COLUMN "damageInsurerAgreementNotes" TEXT,
ADD COLUMN "damageDocumentsJson" JSONB;

-- CreateTable
CREATE TABLE "RoadsideIntervention" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "displayNumber" TEXT,
    "serviceCaseId" TEXT NOT NULL,
    "sourceTicketId" TEXT,
    "workOrderId" TEXT,
    "clientId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "supplierId" TEXT,
    "kind" "RoadsideInterventionKind" NOT NULL,
    "status" "RoadsideInterventionStatus" NOT NULL DEFAULT 'draft',
    "locationText" TEXT,
    "requestedAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "onSiteAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoadsideIntervention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoadsideIntervention_tenantId_idx" ON "RoadsideIntervention"("tenantId");

-- CreateIndex
CREATE INDEX "RoadsideIntervention_serviceCaseId_idx" ON "RoadsideIntervention"("serviceCaseId");

-- CreateIndex
CREATE INDEX "RoadsideIntervention_sourceTicketId_idx" ON "RoadsideIntervention"("sourceTicketId");

-- CreateIndex
CREATE INDEX "RoadsideIntervention_workOrderId_idx" ON "RoadsideIntervention"("workOrderId");

-- CreateIndex
CREATE INDEX "RoadsideIntervention_tenantId_status_idx" ON "RoadsideIntervention"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RoadsideIntervention_tenantId_displayNumber_key" ON "RoadsideIntervention"("tenantId", "displayNumber");

-- AddForeignKey
ALTER TABLE "RoadsideIntervention" ADD CONSTRAINT "RoadsideIntervention_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadsideIntervention" ADD CONSTRAINT "RoadsideIntervention_serviceCaseId_fkey" FOREIGN KEY ("serviceCaseId") REFERENCES "ServiceCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadsideIntervention" ADD CONSTRAINT "RoadsideIntervention_sourceTicketId_fkey" FOREIGN KEY ("sourceTicketId") REFERENCES "CrmTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadsideIntervention" ADD CONSTRAINT "RoadsideIntervention_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "MaintenanceWorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadsideIntervention" ADD CONSTRAINT "RoadsideIntervention_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadsideIntervention" ADD CONSTRAINT "RoadsideIntervention_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadsideIntervention" ADD CONSTRAINT "RoadsideIntervention_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
