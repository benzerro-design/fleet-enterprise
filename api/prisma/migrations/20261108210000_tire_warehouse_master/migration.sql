-- Pachet 1.1 — master data depozit anvelope: Warehouse → Zone → Shelf

CREATE TABLE "TireWarehouse" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addressLine" TEXT,
    "city" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TireWarehouse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TireWarehouseZone" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TireWarehouseZone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TireWarehouseShelf" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "qrPayload" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TireWarehouseShelf_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TireWarehouse_tenantId_supplierId_code_key" ON "TireWarehouse"("tenantId", "supplierId", "code");
CREATE INDEX "TireWarehouse_tenantId_idx" ON "TireWarehouse"("tenantId");
CREATE INDEX "TireWarehouse_supplierId_idx" ON "TireWarehouse"("supplierId");

CREATE UNIQUE INDEX "TireWarehouseZone_warehouseId_code_key" ON "TireWarehouseZone"("warehouseId", "code");
CREATE INDEX "TireWarehouseZone_tenantId_idx" ON "TireWarehouseZone"("tenantId");
CREATE INDEX "TireWarehouseZone_warehouseId_idx" ON "TireWarehouseZone"("warehouseId");

CREATE UNIQUE INDEX "TireWarehouseShelf_zoneId_code_key" ON "TireWarehouseShelf"("zoneId", "code");
CREATE UNIQUE INDEX "TireWarehouseShelf_qrPayload_key" ON "TireWarehouseShelf"("qrPayload");
CREATE INDEX "TireWarehouseShelf_tenantId_idx" ON "TireWarehouseShelf"("tenantId");
CREATE INDEX "TireWarehouseShelf_zoneId_idx" ON "TireWarehouseShelf"("zoneId");

ALTER TABLE "TireWarehouse" ADD CONSTRAINT "TireWarehouse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TireWarehouse" ADD CONSTRAINT "TireWarehouse_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TireWarehouseZone" ADD CONSTRAINT "TireWarehouseZone_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TireWarehouseZone" ADD CONSTRAINT "TireWarehouseZone_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "TireWarehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TireWarehouseShelf" ADD CONSTRAINT "TireWarehouseShelf_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TireWarehouseShelf" ADD CONSTRAINT "TireWarehouseShelf_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "TireWarehouseZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
