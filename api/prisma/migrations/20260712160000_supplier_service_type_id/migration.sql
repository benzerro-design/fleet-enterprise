-- SETUP-007: SupplierService.kind → serviceTypeId (TenantServiceType)

ALTER TABLE "SupplierService" ADD COLUMN "serviceTypeId" TEXT;

UPDATE "SupplierService" ss
SET "serviceTypeId" = tst."id"
FROM "TenantServiceType" tst
WHERE tst."tenantId" = ss."tenantId"
  AND tst."code" = ss."kind"::text;

DELETE FROM "SupplierService" WHERE "serviceTypeId" IS NULL;

ALTER TABLE "SupplierService" ALTER COLUMN "serviceTypeId" SET NOT NULL;

DROP INDEX IF EXISTS "SupplierService_supplierId_kind_key";
DROP INDEX IF EXISTS "SupplierService_tenantId_kind_idx";

ALTER TABLE "SupplierService" DROP COLUMN "kind";

CREATE UNIQUE INDEX "SupplierService_supplierId_serviceTypeId_key" ON "SupplierService"("supplierId", "serviceTypeId");
CREATE INDEX "SupplierService_tenantId_serviceTypeId_idx" ON "SupplierService"("tenantId", "serviceTypeId");

ALTER TABLE "SupplierService" ADD CONSTRAINT "SupplierService_serviceTypeId_fkey"
  FOREIGN KEY ("serviceTypeId") REFERENCES "TenantServiceType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PARTNER-001: invitații furnizor
CREATE TABLE "SupplierInvite" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "SupplierRole" NOT NULL DEFAULT 'supplier_staff',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupplierInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierInvite_token_key" ON "SupplierInvite"("token");
CREATE INDEX "SupplierInvite_tenantId_idx" ON "SupplierInvite"("tenantId");
CREATE INDEX "SupplierInvite_supplierId_idx" ON "SupplierInvite"("supplierId");
CREATE INDEX "SupplierInvite_email_idx" ON "SupplierInvite"("email");

ALTER TABLE "SupplierInvite" ADD CONSTRAINT "SupplierInvite_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierInvite" ADD CONSTRAINT "SupplierInvite_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierInvite" ADD CONSTRAINT "SupplierInvite_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierInvite" ADD CONSTRAINT "SupplierInvite_acceptedByUserId_fkey"
  FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PARTNER-005: mesagerie WO
CREATE TYPE "WorkOrderMessageVisibility" AS ENUM ('internal', 'client_visible');

CREATE TABLE "WorkOrderMessage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" "WorkOrderMessageVisibility" NOT NULL DEFAULT 'client_visible',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkOrderMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkOrderMessage_tenantId_idx" ON "WorkOrderMessage"("tenantId");
CREATE INDEX "WorkOrderMessage_workOrderId_createdAt_idx" ON "WorkOrderMessage"("workOrderId", "createdAt");

ALTER TABLE "WorkOrderMessage" ADD CONSTRAINT "WorkOrderMessage_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkOrderMessage" ADD CONSTRAINT "WorkOrderMessage_workOrderId_fkey"
  FOREIGN KEY ("workOrderId") REFERENCES "MaintenanceWorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkOrderMessage" ADD CONSTRAINT "WorkOrderMessage_authorUserId_fkey"
  FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PARTNER-004: outbox notificări email partener
CREATE TABLE "PartnerNotificationOutbox" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT,
    "toEmail" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payload" JSONB,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartnerNotificationOutbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PartnerNotificationOutbox_tenantId_createdAt_idx" ON "PartnerNotificationOutbox"("tenantId", "createdAt");
CREATE INDEX "PartnerNotificationOutbox_supplierId_idx" ON "PartnerNotificationOutbox"("supplierId");

ALTER TABLE "PartnerNotificationOutbox" ADD CONSTRAINT "PartnerNotificationOutbox_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
