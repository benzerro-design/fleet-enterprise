CREATE TYPE "WorkOrderQuoteParseStatus" AS ENUM ('pending', 'review', 'applied', 'failed');

ALTER TABLE "WorkOrderQuote" ADD COLUMN "sourcePdfUrl" TEXT;
ALTER TABLE "WorkOrderQuote" ADD COLUMN "parseStatus" "WorkOrderQuoteParseStatus";
