-- Override comercial pe client (prag preț suspect etc.).
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "pricingSettings" JSONB;
