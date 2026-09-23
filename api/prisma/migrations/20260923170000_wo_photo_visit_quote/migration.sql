ALTER TABLE "WorkOrderPhoto" ADD COLUMN "visitIndex" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "WorkOrderPhoto" ADD COLUMN "quoteId" TEXT;

CREATE INDEX "WorkOrderPhoto_workOrderId_visitIndex_phase_idx" ON "WorkOrderPhoto"("workOrderId", "visitIndex", "phase");
CREATE INDEX "WorkOrderPhoto_quoteId_idx" ON "WorkOrderPhoto"("quoteId");

ALTER TABLE "WorkOrderPhoto" ADD CONSTRAINT "WorkOrderPhoto_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "WorkOrderQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
