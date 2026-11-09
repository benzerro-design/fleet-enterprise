-- Pachet 1.1b — Warehouse → Zone → Row → Location (înlocuiește Shelf)

CREATE TABLE "TireWarehouseRow" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TireWarehouseRow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TireWarehouseLocation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "qrPayload" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TireWarehouseLocation_pkey" PRIMARY KEY ("id")
);

INSERT INTO "TireWarehouseRow" ("id", "tenantId", "zoneId", "code", "name", "sortOrder", "active", "createdAt", "updatedAt")
SELECT
    s."id",
    s."tenantId",
    s."zoneId",
    s."code",
    s."name",
    0,
    s."active",
    s."createdAt",
    s."updatedAt"
FROM "TireWarehouseShelf" s;

INSERT INTO "TireWarehouseLocation" ("id", "tenantId", "rowId", "code", "name", "qrPayload", "active", "createdAt", "updatedAt")
SELECT
    ('c' || lower(substr(md5(s."id" || ':loc'), 1, 24))),
    s."tenantId",
    s."id",
    '01',
    s."name",
    ('pending:' || s."id"),
    s."active",
    s."createdAt",
    s."updatedAt"
FROM "TireWarehouseShelf" s;

UPDATE "TireWarehouseLocation"
SET "qrPayload" = 'FE:tire-location:' || "id";

DROP TABLE "TireWarehouseShelf";

CREATE UNIQUE INDEX "TireWarehouseRow_zoneId_code_key" ON "TireWarehouseRow"("zoneId", "code");
CREATE INDEX "TireWarehouseRow_tenantId_idx" ON "TireWarehouseRow"("tenantId");
CREATE INDEX "TireWarehouseRow_zoneId_idx" ON "TireWarehouseRow"("zoneId");

CREATE UNIQUE INDEX "TireWarehouseLocation_rowId_code_key" ON "TireWarehouseLocation"("rowId", "code");
CREATE UNIQUE INDEX "TireWarehouseLocation_qrPayload_key" ON "TireWarehouseLocation"("qrPayload");
CREATE INDEX "TireWarehouseLocation_tenantId_idx" ON "TireWarehouseLocation"("tenantId");
CREATE INDEX "TireWarehouseLocation_rowId_idx" ON "TireWarehouseLocation"("rowId");

ALTER TABLE "TireWarehouseRow" ADD CONSTRAINT "TireWarehouseRow_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TireWarehouseRow" ADD CONSTRAINT "TireWarehouseRow_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "TireWarehouseZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TireWarehouseLocation" ADD CONSTRAINT "TireWarehouseLocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TireWarehouseLocation" ADD CONSTRAINT "TireWarehouseLocation_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "TireWarehouseRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
