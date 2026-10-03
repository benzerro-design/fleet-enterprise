-- Custom pipeline steps: store status as text (was Postgres enum).
ALTER TABLE "ServiceCase"
  ALTER COLUMN "damageInsurerPipelineStatus" TYPE TEXT
  USING ("damageInsurerPipelineStatus"::text);

DROP TYPE IF EXISTS "DamageInsurerPipelineStatus";
