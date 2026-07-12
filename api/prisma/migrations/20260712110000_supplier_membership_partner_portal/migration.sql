-- Portal furnizor: supplier_user + SupplierMembership

ALTER TYPE "MembershipRole" ADD VALUE IF NOT EXISTS 'supplier_user';

CREATE TYPE "SupplierRole" AS ENUM ('supplier_manager', 'supplier_staff', 'supplier_accountant');

CREATE TABLE "SupplierMembership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "SupplierRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierMembership_userId_tenantId_supplierId_key" ON "SupplierMembership"("userId", "tenantId", "supplierId");
CREATE INDEX "SupplierMembership_tenantId_idx" ON "SupplierMembership"("tenantId");
CREATE INDEX "SupplierMembership_supplierId_idx" ON "SupplierMembership"("supplierId");
CREATE INDEX "SupplierMembership_userId_idx" ON "SupplierMembership"("userId");

ALTER TABLE "SupplierMembership" ADD CONSTRAINT "SupplierMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierMembership" ADD CONSTRAINT "SupplierMembership_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierMembership" ADD CONSTRAINT "SupplierMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
