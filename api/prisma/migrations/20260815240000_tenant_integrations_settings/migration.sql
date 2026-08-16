-- Setări integrări tenant (Audatex, catalog piese, …).
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "integrationsSettings" JSONB;
