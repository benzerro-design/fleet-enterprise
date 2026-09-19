-- CRM-019: override L1 pe programare pentru politica «Necesar acord șofer»
ALTER TABLE "ServiceAppointment" ADD COLUMN IF NOT EXISTS "requireDriverAckOverride" BOOLEAN;
