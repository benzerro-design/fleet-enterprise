-- IAM-004: tenant functional profile matrix override
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "functionalProfileMatrix" JSONB;

-- IAM-007: persisted grid column layouts per user
CREATE TABLE IF NOT EXISTS "UserGridView" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gridKey" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '__default__',
    "layout" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGridView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserGridView_userId_gridKey_name_key" ON "UserGridView"("userId", "gridKey", "name");
CREATE INDEX IF NOT EXISTS "UserGridView_tenantId_userId_idx" ON "UserGridView"("tenantId", "userId");

ALTER TABLE "UserGridView" DROP CONSTRAINT IF EXISTS "UserGridView_tenantId_fkey";
ALTER TABLE "UserGridView" ADD CONSTRAINT "UserGridView_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserGridView" DROP CONSTRAINT IF EXISTS "UserGridView_userId_fkey";
ALTER TABLE "UserGridView" ADD CONSTRAINT "UserGridView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
