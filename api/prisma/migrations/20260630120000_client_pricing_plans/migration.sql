-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('monthly', 'quarterly', 'yearly', 'custom');

-- CreateEnum
CREATE TYPE "ClientPlanAssignmentStatus" AS ENUM ('active', 'scheduled', 'expired', 'cancelled');

-- CreateTable
CREATE TABLE "PricingPlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'monthly',
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RON',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPlanAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "ClientPlanAssignmentStatus" NOT NULL DEFAULT 'active',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientPlanAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PricingPlan_tenantId_idx" ON "PricingPlan"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PricingPlan_tenantId_code_key" ON "PricingPlan"("tenantId", "code");

-- CreateIndex
CREATE INDEX "ClientPlanAssignment_tenantId_idx" ON "ClientPlanAssignment"("tenantId");

-- CreateIndex
CREATE INDEX "ClientPlanAssignment_clientId_idx" ON "ClientPlanAssignment"("clientId");

-- CreateIndex
CREATE INDEX "ClientPlanAssignment_planId_idx" ON "ClientPlanAssignment"("planId");

-- CreateIndex
CREATE INDEX "ClientPlanAssignment_clientId_status_idx" ON "ClientPlanAssignment"("clientId", "status");

-- AddForeignKey
ALTER TABLE "PricingPlan" ADD CONSTRAINT "PricingPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPlanAssignment" ADD CONSTRAINT "ClientPlanAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPlanAssignment" ADD CONSTRAINT "ClientPlanAssignment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPlanAssignment" ADD CONSTRAINT "ClientPlanAssignment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PricingPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
