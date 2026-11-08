-- FELIA F5 — garanție / documente achiziție + notă contabilitate la casare

ALTER TABLE "TireAsset" ADD COLUMN IF NOT EXISTS "warrantyCertificateUrl" TEXT;
ALTER TABLE "TireAsset" ADD COLUMN IF NOT EXISTS "purchaseDocs" JSONB;

ALTER TABLE "TireSet" ADD COLUMN IF NOT EXISTS "warrantyCertificateUrl" TEXT;
ALTER TABLE "TireSet" ADD COLUMN IF NOT EXISTS "purchaseDocs" JSONB;

ALTER TABLE "TireStorageStay" ADD COLUMN IF NOT EXISTS "accountingNote" TEXT;
