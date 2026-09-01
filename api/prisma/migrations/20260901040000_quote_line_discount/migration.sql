-- UAT-034: discount pe linie de deviz + default piese/manoperă pe furnizor.
ALTER TABLE "Supplier" ADD COLUMN "partsDiscountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Supplier" ADD COLUMN "laborDiscountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "WorkOrderQuoteLine" ADD COLUMN "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "WorkOrderQuoteLine" ADD COLUMN "discountCents" INTEGER NOT NULL DEFAULT 0;
