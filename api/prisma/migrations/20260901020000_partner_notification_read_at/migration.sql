-- UAT-022: citit/necitit in-app pe outbox partener.
ALTER TABLE "PartnerNotificationOutbox" ADD COLUMN "readAt" TIMESTAMP(3);
CREATE INDEX "PartnerNotificationOutbox_supplierId_readAt_idx" ON "PartnerNotificationOutbox"("supplierId", "readAt");
