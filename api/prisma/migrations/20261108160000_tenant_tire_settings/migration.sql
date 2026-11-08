-- Setup → Anvelope: tenant-level tire / hotel policy settings.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "tireSettings" JSONB;
