-- AlterTable
ALTER TABLE "WorkOrderQuote" ADD COLUMN "costEntryId" TEXT,
ADD COLUMN "invoicedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrderQuote_costEntryId_key" ON "WorkOrderQuote"("costEntryId");

-- AddForeignKey
ALTER TABLE "WorkOrderQuote" ADD CONSTRAINT "WorkOrderQuote_costEntryId_fkey" FOREIGN KEY ("costEntryId") REFERENCES "CostEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
