-- CRM-012: first-class ticket attachments (GCS /uploads/tickets)
CREATE TABLE IF NOT EXISTS "CrmTicketAttachment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "eventId" TEXT,
    "url" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CrmTicketAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CrmTicketAttachment_tenantId_idx" ON "CrmTicketAttachment"("tenantId");
CREATE INDEX IF NOT EXISTS "CrmTicketAttachment_ticketId_createdAt_idx" ON "CrmTicketAttachment"("ticketId", "createdAt");
CREATE INDEX IF NOT EXISTS "CrmTicketAttachment_eventId_idx" ON "CrmTicketAttachment"("eventId");

DO $$ BEGIN
  ALTER TABLE "CrmTicketAttachment" ADD CONSTRAINT "CrmTicketAttachment_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CrmTicketAttachment" ADD CONSTRAINT "CrmTicketAttachment_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "CrmTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CrmTicketAttachment" ADD CONSTRAINT "CrmTicketAttachment_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "CrmTicketEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CrmTicketAttachment" ADD CONSTRAINT "CrmTicketAttachment_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
