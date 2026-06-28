-- CreateEnum
CREATE TYPE "ClientRole" AS ENUM ('client_admin', 'client_dispatcher', 'client_viewer', 'driver');

-- AlterEnum
ALTER TYPE "MembershipRole" ADD VALUE 'client_user';

-- AlterTable
ALTER TABLE "CrmTicketEvent" ADD COLUMN "actorRoutingLevel" "CrmTicketRoutingLevel",
ADD COLUMN "actorDisplayName" TEXT;

-- CreateTable
CREATE TABLE "ClientMembership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ClientRole" NOT NULL,
    "driverId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientMembership_tenantId_idx" ON "ClientMembership"("tenantId");

-- CreateIndex
CREATE INDEX "ClientMembership_clientId_idx" ON "ClientMembership"("clientId");

-- CreateIndex
CREATE INDEX "ClientMembership_userId_idx" ON "ClientMembership"("userId");

-- CreateIndex
CREATE INDEX "ClientMembership_driverId_idx" ON "ClientMembership"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientMembership_userId_tenantId_clientId_key" ON "ClientMembership"("userId", "tenantId", "clientId");

-- AddForeignKey
ALTER TABLE "ClientMembership" ADD CONSTRAINT "ClientMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientMembership" ADD CONSTRAINT "ClientMembership_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientMembership" ADD CONSTRAINT "ClientMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientMembership" ADD CONSTRAINT "ClientMembership_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
