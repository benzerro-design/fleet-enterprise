-- INT-004: external service quote idempotency + tenant flag via JSON (no column)

ALTER TABLE "WorkOrderQuote" ADD COLUMN IF NOT EXISTS "externalQuoteId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "WorkOrderQuote_externalQuoteId_key" ON "WorkOrderQuote"("externalQuoteId");
