-- PARTNER-014 Faza C: overlay prețuri pe alocarea Client ↔ Furnizor.
-- Null pe câmp = moștenește fișa tarifară a furnizorului.
ALTER TABLE "ClientSupplierAllocation" ADD COLUMN "partsDiscountPercent" DOUBLE PRECISION;
ALTER TABLE "ClientSupplierAllocation" ADD COLUMN "laborDiscountPercent" DOUBLE PRECISION;
ALTER TABLE "ClientSupplierAllocation" ADD COLUMN "laborRateMechanicalCents" INTEGER;
ALTER TABLE "ClientSupplierAllocation" ADD COLUMN "laborRateBodyCents" INTEGER;
ALTER TABLE "ClientSupplierAllocation" ADD COLUMN "laborRatePaintCents" INTEGER;
ALTER TABLE "ClientSupplierAllocation" ADD COLUMN "laborRateDiagnosticCents" INTEGER;
ALTER TABLE "ClientSupplierAllocation" ADD COLUMN "partsPriceBasis" TEXT;
ALTER TABLE "ClientSupplierAllocation" ADD COLUMN "pricingNotes" TEXT;
ALTER TABLE "ClientSupplierAllocation" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
