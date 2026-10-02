-- FLEET-003: nivel rezervor (FuelLevelReading)
CREATE TYPE "FuelLevelReadingSource" AS ENUM ('manual', 'import', 'telematics');

CREATE TABLE "FuelLevelReading" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liters" DOUBLE PRECISION,
    "percent" DOUBLE PRECISION,
    "source" "FuelLevelReadingSource" NOT NULL DEFAULT 'manual',
    "sourceRef" TEXT,
    "notes" TEXT,
    "recordedByUserId" TEXT,

    CONSTRAINT "FuelLevelReading_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FuelLevelReading_vehicleId_recordedAt_idx" ON "FuelLevelReading"("vehicleId", "recordedAt");

ALTER TABLE "FuelLevelReading" ADD CONSTRAINT "FuelLevelReading_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FuelLevelReading" ADD CONSTRAINT "FuelLevelReading_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
