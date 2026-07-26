-- Catalog asigurători + FK pe dosar daună.
CREATE TABLE "Insurer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Insurer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Insurer_tenantId_name_key" ON "Insurer"("tenantId", "name");
CREATE INDEX "Insurer_tenantId_idx" ON "Insurer"("tenantId");
CREATE INDEX "Insurer_tenantId_active_idx" ON "Insurer"("tenantId", "active");

ALTER TABLE "Insurer" ADD CONSTRAINT "Insurer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceCase" ADD COLUMN "damageInsurerId" TEXT;
CREATE INDEX "ServiceCase_damageInsurerId_idx" ON "ServiceCase"("damageInsurerId");
ALTER TABLE "ServiceCase" ADD CONSTRAINT "ServiceCase_damageInsurerId_fkey" FOREIGN KEY ("damageInsurerId") REFERENCES "Insurer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
