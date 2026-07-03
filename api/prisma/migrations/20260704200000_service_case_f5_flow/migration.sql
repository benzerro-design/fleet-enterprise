-- CreateEnum
CREATE TYPE "PostApprovalPath" AS ENUM ('immediate', 'reschedule');

-- AlterTable
ALTER TABLE "ServiceCase" ADD COLUMN "awaitingPostApproval" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ServiceCase" ADD COLUMN "postApprovalPath" "PostApprovalPath";

-- AlterTable
ALTER TABLE "ServiceAppointment" ADD COLUMN "managerConfirmedAt" TIMESTAMP(3);
ALTER TABLE "ServiceAppointment" ADD COLUMN "driverAcknowledgedAt" TIMESTAMP(3);
