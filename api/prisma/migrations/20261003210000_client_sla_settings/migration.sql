-- Override SLA pe Client (fișa Clientului)
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "slaSettings" JSONB;
