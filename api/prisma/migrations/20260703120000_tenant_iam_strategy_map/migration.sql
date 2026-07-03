-- Hartă IAM editabilă per tenant (Administrare → Strategie useri)
ALTER TABLE "Tenant" ADD COLUMN "iamStrategyMap" JSONB;
