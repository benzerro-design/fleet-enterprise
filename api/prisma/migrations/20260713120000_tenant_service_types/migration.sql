-- Catalog tenant: tipuri service configurabile (Setup → Clienți → Tip & Servicii)

CREATE TABLE "TenantServiceType" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "clientDescription" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "system" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantServiceType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantServiceType_tenantId_code_key" ON "TenantServiceType"("tenantId", "code");
CREATE INDEX "TenantServiceType_tenantId_active_idx" ON "TenantServiceType"("tenantId", "active");
CREATE INDEX "TenantServiceType_tenantId_sortOrder_idx" ON "TenantServiceType"("tenantId", "sortOrder");

ALTER TABLE "TenantServiceType" ADD CONSTRAINT "TenantServiceType_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed catalog din enum SupplierServiceKind pentru fiecare tenant existent
INSERT INTO "TenantServiceType" ("id", "tenantId", "code", "label", "clientDescription", "sortOrder", "active", "system")
SELECT
  'tst_' || t."id" || '_' || k.code,
  t."id",
  k.code,
  k.label,
  k.description,
  k.ord,
  true,
  true
FROM "Tenant" t
CROSS JOIN (
  VALUES
    ('mechanics', 'Mecanică', 'Reparații mecanice, frâne, suspensie, motor', 0),
    ('electrical', 'Electrică', 'Instalații electrice, baterie, alternator', 1),
    ('bodywork_painting', 'Tinichigerie & vopsitorie', 'Tinichigerie, vopsitorie, elemente caroserie', 2),
    ('damage_repair', 'Daune / constatare', 'Daune RCA/CASCO, constatare, dezmembrări', 3),
    ('itp', 'ITP', 'Stație ITP autorizată', 4),
    ('tire_service', 'Vulcanizare / anvelope', 'Montaj anvelope, echilibrare, vulcanizare', 5),
    ('periodic_maintenance', 'Revizie periodică', 'Revizii planificate, schimburi ulei/filtre', 6),
    ('ac_climate', 'Climatizare', 'Încărcare freon, service climatizare', 7),
    ('diagnostics', 'Diagnoză computerizată', 'Tester OBD, identificare defecțiuni', 8),
    ('towing', 'Tractări / asistență rutieră', 'Tractări auto, platformă', 9),
    ('glass_repair', 'Parbrize & geamuri', 'Înlocuire parbriz, lunetă, geamuri laterale', 10)
) AS k(code, label, description, ord)
ON CONFLICT ("tenantId", "code") DO NOTHING;
