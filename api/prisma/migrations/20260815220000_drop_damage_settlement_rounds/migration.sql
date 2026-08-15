-- Cleanup: feature „runde decontare” retrasă — coloane nefolosite.
ALTER TABLE "ServiceCase" DROP COLUMN IF EXISTS "damagePaymentAcceptancesJson";
ALTER TABLE "ServiceCase" DROP COLUMN IF EXISTS "damageSettlementRoundsJson";
