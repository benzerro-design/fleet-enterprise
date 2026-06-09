-- CreateEnum
CREATE TYPE "AcquisitionType" AS ENUM ('cash', 'financial_leasing', 'operational_leasing');

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "acquisitionType" "AcquisitionType",
ADD COLUMN     "acquiredOn" TIMESTAMP(3),
ADD COLUMN     "dealerName" TEXT,
ADD COLUMN     "financierName" TEXT,
ADD COLUMN     "purchasePriceCents" INTEGER,
ADD COLUMN     "downPaymentCents" INTEGER,
ADD COLUMN     "contractNumber" TEXT,
ADD COLUMN     "contractStartOn" TIMESTAMP(3),
ADD COLUMN     "contractEndOn" TIMESTAMP(3),
ADD COLUMN     "monthlyPaymentCents" INTEGER,
ADD COLUMN     "residualValueCents" INTEGER,
ADD COLUMN     "warrantyExpiresOn" TIMESTAMP(3),
ADD COLUMN     "warrantyKmLimit" INTEGER,
ADD COLUMN     "warrantyProvider" TEXT,
ADD COLUMN     "acquisitionNotes" TEXT;

-- CreateTable
CREATE TABLE "VehiclePhoto" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedByUserId" TEXT,

    CONSTRAINT "VehiclePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehiclePhoto_vehicleId_idx" ON "VehiclePhoto"("vehicleId");

-- CreateIndex
CREATE INDEX "VehiclePhoto_vehicleId_sortOrder_idx" ON "VehiclePhoto"("vehicleId", "sortOrder");

-- AddForeignKey
ALTER TABLE "VehiclePhoto" ADD CONSTRAINT "VehiclePhoto_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehiclePhoto" ADD CONSTRAINT "VehiclePhoto_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
