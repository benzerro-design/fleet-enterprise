-- Quarantine keeps the set in inventory (blocked) instead of releasing it.
ALTER TABLE "TireStorageStay" ADD COLUMN "quarantinedAt" TIMESTAMP(3);
ALTER TABLE "TireStorageStay" ADD COLUMN "quarantineReason" TEXT;

-- Kind-specific PV fields: transfer destination, scrap accounting note, CRM ticket for check-out.
ALTER TABLE "TireCustodyProtocol" ADD COLUMN "targetSupplierId" TEXT;
ALTER TABLE "TireCustodyProtocol" ADD COLUMN "targetLocationCode" TEXT;
ALTER TABLE "TireCustodyProtocol" ADD COLUMN "accountingNote" TEXT;
ALTER TABLE "TireCustodyProtocol" ADD COLUMN "ticketId" TEXT;
