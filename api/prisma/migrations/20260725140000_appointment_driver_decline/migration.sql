-- AlterEnum
ALTER TYPE "ServiceAppointmentStatus" ADD VALUE IF NOT EXISTS 'needs_repropose';

-- AlterTable
ALTER TABLE "ServiceAppointment" ADD COLUMN IF NOT EXISTS "driverDeclinedAt" TIMESTAMP(3);
ALTER TABLE "ServiceAppointment" ADD COLUMN IF NOT EXISTS "driverDeclineNote" TEXT;
ALTER TABLE "ServiceAppointment" ADD COLUMN IF NOT EXISTS "lastProposalNote" TEXT;
