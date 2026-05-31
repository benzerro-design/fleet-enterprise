-- AlterEnum
ALTER TYPE "ReminderSourceType" ADD VALUE 'vehicle_itp';

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN "itpReminderOffsetsDays" JSONB;
ALTER TABLE "Vehicle" ADD COLUMN "itpReminderMenuSyncEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "ReminderAction" ADD COLUMN "vehicleItpProfileVehicleId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ReminderAction_vehicleItpProfileVehicleId_key" ON "ReminderAction"("vehicleItpProfileVehicleId");

-- AddForeignKey
ALTER TABLE "ReminderAction" ADD CONSTRAINT "ReminderAction_vehicleItpProfileVehicleId_fkey" FOREIGN KEY ("vehicleItpProfileVehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
