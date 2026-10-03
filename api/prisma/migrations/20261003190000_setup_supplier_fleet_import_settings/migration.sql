-- Tenant Setup: Furnizori / Flotă / Importuri JSON bags
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "supplierSettings" JSONB;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "fleetSettings" JSONB;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "importSettings" JSONB;

-- Supplier.category: enum → text (custom categories from Setup)
ALTER TABLE "Supplier"
  ALTER COLUMN "category" DROP DEFAULT,
  ALTER COLUMN "category" TYPE TEXT USING ("category"::text),
  ALTER COLUMN "category" SET DEFAULT 'other';

DROP TYPE IF EXISTS "SupplierCategory";

-- SupplierDocument.kind: enum → text
ALTER TABLE "SupplierDocument"
  ALTER COLUMN "kind" DROP DEFAULT,
  ALTER COLUMN "kind" TYPE TEXT USING ("kind"::text),
  ALTER COLUMN "kind" SET DEFAULT 'other';

DROP TYPE IF EXISTS "SupplierDocumentKind";

-- VehicleEquipment.kind: enum → text
ALTER TABLE "VehicleEquipment"
  ALTER COLUMN "kind" DROP DEFAULT,
  ALTER COLUMN "kind" TYPE TEXT USING ("kind"::text),
  ALTER COLUMN "kind" SET DEFAULT 'other';

DROP TYPE IF EXISTS "VehicleEquipmentKind";
