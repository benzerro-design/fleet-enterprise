-- PARTNER-014 Faza A: fișă tarifară reală (tarife/oră + baza pieselor).
ALTER TABLE "Supplier" ADD COLUMN "laborRateMechanicalCents" INTEGER;
ALTER TABLE "Supplier" ADD COLUMN "laborRateBodyCents" INTEGER;
ALTER TABLE "Supplier" ADD COLUMN "laborRatePaintCents" INTEGER;
ALTER TABLE "Supplier" ADD COLUMN "laborRateDiagnosticCents" INTEGER;
ALTER TABLE "Supplier" ADD COLUMN "partsPriceBasis" TEXT NOT NULL DEFAULT 'list';
ALTER TABLE "Supplier" ADD COLUMN "pricingNotes" TEXT;
