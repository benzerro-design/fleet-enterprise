-- Istoric accept plată + runde de decontare pe dosarul de daună.
ALTER TABLE "ServiceCase" ADD COLUMN IF NOT EXISTS "damagePaymentAcceptancesJson" JSONB;
ALTER TABLE "ServiceCase" ADD COLUMN IF NOT EXISTS "damageSettlementRoundsJson" JSONB;
