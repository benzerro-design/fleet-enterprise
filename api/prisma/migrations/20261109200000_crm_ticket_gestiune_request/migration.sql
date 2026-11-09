-- Pachet 1.3: solicitare de gestiune pe CrmTicket (op + partener alocat).

CREATE TYPE "TireGestiuneOp" AS ENUM ('cazare', 'eliberare', 'transfer', 'casare');

ALTER TABLE "CrmTicket"
  ADD COLUMN "assignedSupplierId" TEXT,
  ADD COLUMN "gestiuneOp" "TireGestiuneOp";

ALTER TABLE "CrmTicket"
  ADD CONSTRAINT "CrmTicket_assignedSupplierId_fkey"
  FOREIGN KEY ("assignedSupplierId") REFERENCES "Supplier"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "CrmTicket_assignedSupplierId_idx" ON "CrmTicket"("assignedSupplierId");
CREATE INDEX "CrmTicket_tenantId_gestiuneOp_idx" ON "CrmTicket"("tenantId", "gestiuneOp");
