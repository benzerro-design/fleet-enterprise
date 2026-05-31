-- CreateEnum
CREATE TYPE "ReminderSourceType" AS ENUM ('document', 'maintenance', 'custom');

-- CreateTable
CREATE TABLE "ReminderAction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "sourceType" "ReminderSourceType" NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "vehicleDocumentId" TEXT,
    "maintenanceEntryId" TEXT,
    "dueOn" TIMESTAMP(3),
    "reminderOffsetsDays" JSONB,
    "dueOdometerKm" INTEGER,
    "reminderOffsetsKm" JSONB,
    "intervalDays" INTEGER,
    "intervalKm" INTEGER,
    "lastPerformedOn" TIMESTAMP(3),
    "lastPerformedOdometerKm" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReminderAction_vehicleDocumentId_key" ON "ReminderAction"("vehicleDocumentId");
CREATE UNIQUE INDEX "ReminderAction_maintenanceEntryId_key" ON "ReminderAction"("maintenanceEntryId");
CREATE INDEX "ReminderAction_tenantId_idx" ON "ReminderAction"("tenantId");
CREATE INDEX "ReminderAction_vehicleId_idx" ON "ReminderAction"("vehicleId");
CREATE INDEX "ReminderAction_dueOn_idx" ON "ReminderAction"("dueOn");
CREATE INDEX "ReminderAction_sourceType_idx" ON "ReminderAction"("sourceType");

-- AddForeignKey
ALTER TABLE "ReminderAction" ADD CONSTRAINT "ReminderAction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReminderAction" ADD CONSTRAINT "ReminderAction_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReminderAction" ADD CONSTRAINT "ReminderAction_vehicleDocumentId_fkey" FOREIGN KEY ("vehicleDocumentId") REFERENCES "VehicleDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReminderAction" ADD CONSTRAINT "ReminderAction_maintenanceEntryId_fkey" FOREIGN KEY ("maintenanceEntryId") REFERENCES "MaintenanceEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
