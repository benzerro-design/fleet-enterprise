-- Servicii multi-select per furnizor (mecanică, ITP, vulcanizare, etc.)

CREATE TYPE "SupplierServiceKind" AS ENUM (
  'mechanics',
  'electrical',
  'bodywork_painting',
  'damage_repair',
  'itp',
  'tire_service',
  'periodic_maintenance',
  'ac_climate',
  'diagnostics',
  'towing',
  'glass_repair'
);

CREATE TABLE "SupplierService" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "kind" "SupplierServiceKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierService_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierService_supplierId_kind_key" ON "SupplierService"("supplierId", "kind");
CREATE INDEX "SupplierService_tenantId_idx" ON "SupplierService"("tenantId");
CREATE INDEX "SupplierService_supplierId_idx" ON "SupplierService"("supplierId");
CREATE INDEX "SupplierService_tenantId_kind_idx" ON "SupplierService"("tenantId", "kind");

ALTER TABLE "SupplierService" ADD CONSTRAINT "SupplierService_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierService" ADD CONSTRAINT "SupplierService_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill din category existent (un serviciu implicit per furnizor)
INSERT INTO "SupplierService" ("id", "tenantId", "supplierId", "kind")
SELECT
  'bf_' || s."id" || '_' || (
    CASE s."category"
      WHEN 'itp' THEN 'itp'
      WHEN 'tires' THEN 'tire_service'
      WHEN 'fuel' THEN 'periodic_maintenance'
      WHEN 'roadside_assistance' THEN 'towing'
      WHEN 'service_auto' THEN 'mechanics'
      ELSE 'mechanics'
    END
  ),
  s."tenantId",
  s."id",
  CASE s."category"
    WHEN 'itp' THEN 'itp'::"SupplierServiceKind"
    WHEN 'tires' THEN 'tire_service'::"SupplierServiceKind"
    WHEN 'fuel' THEN 'periodic_maintenance'::"SupplierServiceKind"
    WHEN 'roadside_assistance' THEN 'towing'::"SupplierServiceKind"
    WHEN 'service_auto' THEN 'mechanics'::"SupplierServiceKind"
    ELSE 'mechanics'::"SupplierServiceKind"
  END
FROM "Supplier" s
ON CONFLICT ("supplierId", "kind") DO NOTHING;
