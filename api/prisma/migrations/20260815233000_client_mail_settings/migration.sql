-- CC / setări mail daună pe client (merge cu Tenant.mailSettings).
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "mailSettings" JSONB;
