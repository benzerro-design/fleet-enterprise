-- PARTNER-003: documente firmă furnizor + expirare
CREATE TYPE "SupplierDocumentKind" AS ENUM (
  'onrc',
  'cui_fiscal',
  'rar_auth',
  'itp_auth',
  'rc_professional',
  'other'
);

CREATE TABLE "SupplierDocument" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "kind" "SupplierDocumentKind" NOT NULL DEFAULT 'other',
  "title" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT,
  "expiresOn" TIMESTAMP(3),
  "required" BOOLEAN NOT NULL DEFAULT false,
  "uploadedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SupplierDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplierDocument_tenantId_idx" ON "SupplierDocument"("tenantId");
CREATE INDEX "SupplierDocument_supplierId_kind_idx" ON "SupplierDocument"("supplierId", "kind");
CREATE INDEX "SupplierDocument_supplierId_expiresOn_idx" ON "SupplierDocument"("supplierId", "expiresOn");

ALTER TABLE "SupplierDocument" ADD CONSTRAINT "SupplierDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierDocument" ADD CONSTRAINT "SupplierDocument_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierDocument" ADD CONSTRAINT "SupplierDocument_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
