-- AlterTable
ALTER TABLE "MaintenanceEntry" ADD COLUMN     "warrantyRepair" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "potentialCostCents" INTEGER;
