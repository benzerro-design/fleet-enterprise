-- Idempotent finish after a partial apply of 20260601200000_client_organization.
-- Safe to run if migrate deploy failed on the INTERN insert (Tenant.id vs tenantId).

INSERT INTO "Client" ("id", "tenantId", "code", "legalName", "status", "createdAt", "updatedAt")
SELECT
    'cl_' || substr(md5(t."id" || '|__internal__'), 1, 22),
    t."id",
    'INTERN',
    'Intern / neasignat',
    'active'::"ClientStatus",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Tenant" t
WHERE NOT EXISTS (
    SELECT 1 FROM "Client" c WHERE c."tenantId" = t."id" AND c."code" = 'INTERN'
);

UPDATE "Vehicle" v
SET "clientId" = c."id"
FROM "Client" c
WHERE v."clientId" IS NULL
  AND c."tenantId" = v."tenantId"
  AND c."code" = 'INTERN';

ALTER TABLE "Vehicle" DROP COLUMN IF EXISTS "legacyClientCode";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Vehicle' AND column_name = 'clientId' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE "Vehicle" ALTER COLUMN "clientId" SET NOT NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Client_tenantId_code_key" ON "Client"("tenantId", "code");
CREATE INDEX IF NOT EXISTS "Client_tenantId_idx" ON "Client"("tenantId");
CREATE INDEX IF NOT EXISTS "Client_tenantId_status_idx" ON "Client"("tenantId", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Client_tenantId_fkey'
  ) THEN
    ALTER TABLE "Client" ADD CONSTRAINT "Client_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Vehicle_clientId_fkey'
  ) THEN
    ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
