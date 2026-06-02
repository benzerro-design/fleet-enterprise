-- Trip sheet PDFs: object storage key + optional legacy BYTEA
ALTER TABLE "TripSheetDocument" ADD COLUMN "pdfStorageKey" TEXT;
ALTER TABLE "TripSheetDocument" ADD COLUMN "pdfByteSize" INTEGER;
ALTER TABLE "TripSheetDocument" ALTER COLUMN "pdfData" DROP NOT NULL;
