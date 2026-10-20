-- FLEET-007 P1: WO tip R (anvelope) + intent + idempotency close
ALTER TYPE "ServiceOrderType" ADD VALUE 'R';

ALTER TABLE "MaintenanceWorkOrder"
  ADD COLUMN "tyreWorkIntent" TEXT,
  ADD COLUMN "tyreCloseAppliedAt" TIMESTAMP(3);
