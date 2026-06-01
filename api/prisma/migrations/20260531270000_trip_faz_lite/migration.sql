-- CreateEnum
CREATE TYPE "TripPurpose" AS ENUM ('business', 'personal', 'mixed');

-- CreateEnum
CREATE TYPE "TripRoadType" AS ENUM ('urban', 'extra_urban', 'highway', 'mixed');

-- CreateEnum
CREATE TYPE "TripSheetDocType" AS ENUM ('trip_sheet', 'faz_monthly');

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "purpose" "TripPurpose",
ADD COLUMN     "roadType" "TripRoadType",
ADD COLUMN     "odometerStartKm" INTEGER,
ADD COLUMN     "odometerEndKm" INTEGER,
ADD COLUMN     "driverName" TEXT;

-- CreateTable
CREATE TABLE "TripSheetDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "docType" "TripSheetDocType" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "vehicleIds" TEXT[],
    "driverName" TEXT,
    "clientIdFilter" TEXT,
    "title" TEXT NOT NULL,
    "summaryJson" JSONB NOT NULL,
    "pdfData" BYTEA NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripSheetDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TripSheetDocument_tenantId_createdAt_idx" ON "TripSheetDocument"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "TripSheetDocument" ADD CONSTRAINT "TripSheetDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
