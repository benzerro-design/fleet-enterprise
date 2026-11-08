-- FLEET-007 Build #1b: archive PDF + optional WO link on custody protocol

ALTER TABLE "TireCustodyProtocol" ADD COLUMN "workOrderId" TEXT;
ALTER TABLE "TireCustodyProtocol" ADD COLUMN "pdfSha256" TEXT;
ALTER TABLE "TireCustodyProtocol" ADD COLUMN "pdfArchivedAt" TIMESTAMP(3);
ALTER TABLE "TireCustodyProtocol" ADD COLUMN "pdfBytes" BYTEA;

CREATE INDEX "TireCustodyProtocol_workOrderId_idx" ON "TireCustodyProtocol"("workOrderId");

ALTER TABLE "TireCustodyProtocol" ADD CONSTRAINT "TireCustodyProtocol_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "MaintenanceWorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
