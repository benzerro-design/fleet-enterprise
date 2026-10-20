-- FLEET-007 P2 — TireStorageStay (hotel anvelope MVP)

CREATE TABLE "TireStorageStay" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "locationCode" TEXT,
    "checkInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOutAt" TIMESTAMP(3),
    "intakePhotos" JSONB,
    "intakeTreadNotes" TEXT,
    "feeCents" INTEGER,
    "contractRef" TEXT,
    "externalId" TEXT,
    "sourceSystem" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TireStorageStay_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TireStorageStay_tenantId_idx" ON "TireStorageStay"("tenantId");
CREATE INDEX "TireStorageStay_supplierId_checkOutAt_idx" ON "TireStorageStay"("supplierId", "checkOutAt");
CREATE INDEX "TireStorageStay_setId_checkOutAt_idx" ON "TireStorageStay"("setId", "checkOutAt");

ALTER TABLE "TireStorageStay" ADD CONSTRAINT "TireStorageStay_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TireStorageStay" ADD CONSTRAINT "TireStorageStay_setId_fkey" FOREIGN KEY ("setId") REFERENCES "TireSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TireStorageStay" ADD CONSTRAINT "TireStorageStay_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
