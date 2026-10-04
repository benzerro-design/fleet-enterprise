-- PARTNER-014 Faza B: meniuri atelier cu preț fix.
CREATE TABLE "SupplierMenuItem" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "lineType" TEXT NOT NULL DEFAULT 'other',
  "unitNetCents" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SupplierMenuItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplierMenuItem_tenantId_idx" ON "SupplierMenuItem"("tenantId");
CREATE INDEX "SupplierMenuItem_supplierId_idx" ON "SupplierMenuItem"("supplierId");
CREATE INDEX "SupplierMenuItem_supplierId_active_sortOrder_idx" ON "SupplierMenuItem"("supplierId", "active", "sortOrder");

ALTER TABLE "SupplierMenuItem"
  ADD CONSTRAINT "SupplierMenuItem_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierMenuItem"
  ADD CONSTRAINT "SupplierMenuItem_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
