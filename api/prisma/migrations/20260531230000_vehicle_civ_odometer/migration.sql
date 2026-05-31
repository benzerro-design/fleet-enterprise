-- CreateEnum
CREATE TYPE "OdometerReadingSource" AS ENUM ('manual', 'tracking', 'import');

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN "civSeries" TEXT,
ADD COLUMN "civIssuedOn" TIMESTAMP(3),
ADD COLUMN "civRarOffice" TEXT,
ADD COLUMN "civProfile" JSONB,
ADD COLUMN "civMentions" TEXT,
ADD COLUMN "civImportedFromDocumentId" TEXT;

-- CreateTable
CREATE TABLE "OdometerReading" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "odometerKm" INTEGER NOT NULL,
    "source" "OdometerReadingSource" NOT NULL DEFAULT 'manual',
    "sourceRef" TEXT,
    "notes" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedByUserId" TEXT,

    CONSTRAINT "OdometerReading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OdometerReading_vehicleId_recordedAt_idx" ON "OdometerReading"("vehicleId", "recordedAt");

-- AddForeignKey
ALTER TABLE "OdometerReading" ADD CONSTRAINT "OdometerReading_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OdometerReading" ADD CONSTRAINT "OdometerReading_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed initial odometer reading from current vehicle km
INSERT INTO "OdometerReading" ("id", "vehicleId", "odometerKm", "source", "notes", "recordedAt")
SELECT
  'odoseed_' || "id",
  "id",
  "odometerKm",
  'import'::"OdometerReadingSource",
  'Migrare — km existent la activarea istoricului odometru',
  COALESCE("updatedAt", "createdAt")
FROM "Vehicle"
WHERE "odometerKm" > 0;
