-- UAT-011: furnizor vizibil L1 doar după alocare L*.
CREATE TABLE "ClientSupplierAllocation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientSupplierAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientSupplierAllocation_clientId_supplierId_key" ON "ClientSupplierAllocation"("clientId", "supplierId");
CREATE INDEX "ClientSupplierAllocation_tenantId_idx" ON "ClientSupplierAllocation"("tenantId");
CREATE INDEX "ClientSupplierAllocation_supplierId_idx" ON "ClientSupplierAllocation"("supplierId");

ALTER TABLE "ClientSupplierAllocation" ADD CONSTRAINT "ClientSupplierAllocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientSupplierAllocation" ADD CONSTRAINT "ClientSupplierAllocation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientSupplierAllocation" ADD CONSTRAINT "ClientSupplierAllocation_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill din relații existente (cost, mentenanță, WO, dosar, programări).
INSERT INTO "ClientSupplierAllocation" ("id", "tenantId", "clientId", "supplierId")
SELECT DISTINCT ON ("clientId", "supplierId")
  md5("tenantId" || "clientId" || "supplierId"),
  "tenantId",
  "clientId",
  "supplierId"
FROM (
  SELECT e."tenantId", v."clientId", e."supplierId"
  FROM "CostEntry" e
  JOIN "Vehicle" v ON v."id" = e."vehicleId"
  WHERE e."supplierId" IS NOT NULL
  UNION
  SELECT m."tenantId", v."clientId", m."supplierId"
  FROM "MaintenanceEntry" m
  JOIN "Vehicle" v ON v."id" = m."vehicleId"
  WHERE m."supplierId" IS NOT NULL
  UNION
  SELECT w."tenantId", v."clientId", w."supplierId"
  FROM "MaintenanceWorkOrder" w
  JOIN "Vehicle" v ON v."id" = w."vehicleId"
  WHERE w."supplierId" IS NOT NULL
  UNION
  SELECT sc."tenantId", sc."clientId", sc."supplierId"
  FROM "ServiceCase" sc
  WHERE sc."supplierId" IS NOT NULL
  UNION
  SELECT a."tenantId", v."clientId", a."supplierId"
  FROM "ServiceAppointment" a
  JOIN "Vehicle" v ON v."id" = a."vehicleId"
  WHERE a."supplierId" IS NOT NULL
) src
ORDER BY "clientId", "supplierId"
ON CONFLICT ("clientId", "supplierId") DO NOTHING;
