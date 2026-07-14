-- CRM-011 / DATA-002: CrmTicket.serviceTypeId + ServiceCase.serviceTypeId
-- PARTNER-004: outbox delivery metadata

ALTER TABLE "CrmTicket" ADD COLUMN IF NOT EXISTS "serviceTypeId" TEXT;

UPDATE "CrmTicket" t
SET "serviceTypeId" = tst."id"
FROM "TenantServiceType" tst
WHERE tst."tenantId" = t."tenantId"
  AND t."serviceTypeId" IS NULL
  AND tst.code = CASE t."ticketType"
    WHEN 'itp' THEN 'itp'
    WHEN 'damage' THEN 'damage_repair'
    WHEN 'maintenance' THEN 'mechanics'
    WHEN 'document' THEN 'diagnostics'
    WHEN 'transport' THEN 'towing'
    WHEN 'technical' THEN 'diagnostics'
    ELSE 'mechanics'
  END;

ALTER TABLE "ServiceCase" ADD COLUMN IF NOT EXISTS "serviceTypeId" TEXT;

UPDATE "ServiceCase" sc
SET "serviceTypeId" = t."serviceTypeId"
FROM "CrmTicket" t
WHERE sc."sourceTicketId" = t."id"
  AND sc."serviceTypeId" IS NULL
  AND t."serviceTypeId" IS NOT NULL;

ALTER TABLE "PartnerNotificationOutbox" ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PartnerNotificationOutbox" ADD COLUMN IF NOT EXISTS "lastError" TEXT;

CREATE INDEX IF NOT EXISTS "CrmTicket_serviceTypeId_idx" ON "CrmTicket"("serviceTypeId");
CREATE INDEX IF NOT EXISTS "ServiceCase_serviceTypeId_idx" ON "ServiceCase"("serviceTypeId");
CREATE INDEX IF NOT EXISTS "PartnerNotificationOutbox_sentAt_idx" ON "PartnerNotificationOutbox"("sentAt");

ALTER TABLE "CrmTicket" ADD CONSTRAINT "CrmTicket_serviceTypeId_fkey"
  FOREIGN KEY ("serviceTypeId") REFERENCES "TenantServiceType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ServiceCase" ADD CONSTRAINT "ServiceCase_serviceTypeId_fkey"
  FOREIGN KEY ("serviceTypeId") REFERENCES "TenantServiceType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
