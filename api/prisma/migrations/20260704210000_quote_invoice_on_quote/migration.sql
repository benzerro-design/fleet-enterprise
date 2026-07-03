-- Factură înregistrată pe deviz înainte de generarea costului
ALTER TABLE "WorkOrderQuote" ADD COLUMN "invoiceNumber" TEXT;
ALTER TABLE "WorkOrderQuote" ADD COLUMN "invoiceDate" TIMESTAMP(3);
ALTER TABLE "WorkOrderQuote" ADD COLUMN "invoiceAttachmentUrl" TEXT;
