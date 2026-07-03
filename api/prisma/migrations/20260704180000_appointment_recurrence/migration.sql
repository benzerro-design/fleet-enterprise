-- CreateEnum
CREATE TYPE "ServiceAppointmentRecurrence" AS ENUM ('none', 'weekly', 'biweekly', 'monthly');

-- AlterTable
ALTER TABLE "ServiceAppointment" ADD COLUMN "recurrenceRule" "ServiceAppointmentRecurrence" NOT NULL DEFAULT 'none';
ALTER TABLE "ServiceAppointment" ADD COLUMN "recurrenceSeriesId" TEXT;

-- CreateIndex
CREATE INDEX "ServiceAppointment_recurrenceSeriesId_idx" ON "ServiceAppointment"("recurrenceSeriesId");
