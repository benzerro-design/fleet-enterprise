-- F5f: tip comandă service + reper „lucrare gata”
CREATE TYPE "ServiceOrderType" AS ENUM ('M', 'E', 'D', 'TV');

ALTER TABLE "MaintenanceWorkOrder"
  ADD COLUMN "serviceOrderType" "ServiceOrderType" NOT NULL DEFAULT 'M',
  ADD COLUMN "readyAt" TIMESTAMP(3);
