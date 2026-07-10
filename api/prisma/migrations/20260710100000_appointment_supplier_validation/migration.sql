-- AlterEnum
ALTER TYPE "ServiceAppointmentStatus" ADD VALUE IF NOT EXISTS 'pending_supplier';

-- CreateEnum
CREATE TYPE "ServiceAppointmentProposedBy" AS ENUM ('tenant_admin', 'client_manager', 'supplier');

-- AlterTable
ALTER TABLE "ServiceAppointment" ADD COLUMN "proposedByRole" "ServiceAppointmentProposedBy";
ALTER TABLE "ServiceAppointment" ADD COLUMN "supplierValidatedAt" TIMESTAMP(3);
