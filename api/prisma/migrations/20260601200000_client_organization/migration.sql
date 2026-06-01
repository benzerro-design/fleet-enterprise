-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('active', 'inactive');

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "taxId" TEXT,
    "status" "ClientStatus" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- Migrate legacy free-text clientId on Vehicle -> Client rows
ALTER TABLE "Vehicle" RENAME COLUMN "clientId" TO "legacyClientCode";

ALTER TABLE "Vehicle" ADD COLUMN "clientId" TEXT;

INSERT INTO "Client" ("id", "tenantId", "code", "legalName", "status", "createdAt", "updatedAt")
SELECT
    'cl_' || substr(md5("tenantId" || '|' || lower(trim("legacyClientCode"))), 1, 22),
    "tenantId",
    trim("legacyClientCode"),
    trim("legacyClientCode"),
    'active'::"ClientStatus",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Vehicle"
WHERE trim("legacyClientCode") <> ''
GROUP BY "tenantId", lower(trim("legacyClientCode")), trim("legacyClientCode");

UPDATE "Vehicle" v
SET "clientId" = c."id"
FROM "Client" c
WHERE c."tenantId" = v."tenantId"
  AND lower(c."code") = lower(trim(v."legacyClientCode"));

-- Fallback for empty legacy codes
INSERT INTO "Client" ("id", "tenantId", "code", "legalName", "status", "createdAt", "updatedAt")
SELECT
    'cl_' || substr(md5("tenantId" || '|__internal__'), 1, 22),
    "tenantId",
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

ALTER TABLE "Vehicle" DROP COLUMN "legacyClientCode";

ALTER TABLE "Vehicle" ALTER COLUMN "clientId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Client_tenantId_code_key" ON "Client"("tenantId", "code");

CREATE INDEX "Client_tenantId_idx" ON "Client"("tenantId");

CREATE INDEX "Client_tenantId_status_idx" ON "Client"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
