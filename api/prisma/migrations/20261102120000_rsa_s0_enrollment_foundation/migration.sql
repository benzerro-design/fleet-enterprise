-- RSA-S0: profil furnizor asistență, planuri abonament, înrolări vehicul

CREATE TYPE "RsaEnrollmentStatus" AS ENUM (
  'pending_sync',
  'active',
  'suspended',
  'expired',
  'cancelled'
);

CREATE TABLE "RsaSupplierProfile" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "is24x7" BOOLEAN NOT NULL DEFAULT true,
  "dispatchPhone24x7" TEXT,
  "dispatchEmail" TEXT,
  "coverageCountiesJson" JSONB NOT NULL DEFAULT '[]',
  "crossBorderEnabled" BOOLEAN NOT NULL DEFAULT false,
  "supportedKindsJson" JSONB NOT NULL DEFAULT '["tow","jump_start","tire_change","lockout","fuel_delivery","other"]',
  "slaAckMinutes" INTEGER NOT NULL DEFAULT 10,
  "slaArrivalUrbanMinutes" INTEGER NOT NULL DEFAULT 45,
  "slaArrivalHighwayMinutes" INTEGER NOT NULL DEFAULT 60,
  "baseCalloutOutPlanCents" INTEGER NOT NULL DEFAULT 0,
  "towHookOutPlanCents" INTEGER NOT NULL DEFAULT 0,
  "towPerKmOutPlanCents" INTEGER NOT NULL DEFAULT 0,
  "winchSurchargeCents" INTEGER NOT NULL DEFAULT 0,
  "nightWeekendMultiplierPct" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RsaSupplierProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RsaSupplierProfile_supplierId_key" ON "RsaSupplierProfile"("supplierId");
CREATE INDEX "RsaSupplierProfile_tenantId_idx" ON "RsaSupplierProfile"("tenantId");

ALTER TABLE "RsaSupplierProfile"
  ADD CONSTRAINT "RsaSupplierProfile_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RsaSupplierProfile"
  ADD CONSTRAINT "RsaSupplierProfile_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RsaPlan" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "monthlyFeePerVehicleCents" INTEGER NOT NULL DEFAULT 0,
  "featuresJson" JSONB NOT NULL DEFAULT '{"tow":true,"jump_start":true,"tire_change":true,"lockout":true,"fuel_delivery":true,"other":false}',
  "includedTowKm" INTEGER NOT NULL DEFAULT 100,
  "maxInterventionsPerYear" INTEGER,
  "overagePerKmCents" INTEGER NOT NULL DEFAULT 0,
  "mobilityIncluded" BOOLEAN NOT NULL DEFAULT false,
  "mobilityMaxDays" INTEGER,
  "mobilityTriggerHours" INTEGER DEFAULT 0,
  "mobilityVehicleClass" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RsaPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RsaPlan_tenantId_supplierId_code_key" ON "RsaPlan"("tenantId", "supplierId", "code");
CREATE INDEX "RsaPlan_tenantId_supplierId_active_idx" ON "RsaPlan"("tenantId", "supplierId", "active");

ALTER TABLE "RsaPlan"
  ADD CONSTRAINT "RsaPlan_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RsaPlan"
  ADD CONSTRAINT "RsaPlan_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RsaVehicleEnrollment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "status" "RsaEnrollmentStatus" NOT NULL DEFAULT 'active',
  "externalSubscriptionNo" TEXT,
  "validFrom" DATE NOT NULL,
  "validUntil" DATE,
  "interventionsUsedCount" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RsaVehicleEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RsaVehicleEnrollment_tenantId_vehicleId_status_idx"
  ON "RsaVehicleEnrollment"("tenantId", "vehicleId", "status");
CREATE INDEX "RsaVehicleEnrollment_tenantId_clientId_status_idx"
  ON "RsaVehicleEnrollment"("tenantId", "clientId", "status");
CREATE INDEX "RsaVehicleEnrollment_supplierId_status_idx"
  ON "RsaVehicleEnrollment"("supplierId", "status");
CREATE INDEX "RsaVehicleEnrollment_planId_idx"
  ON "RsaVehicleEnrollment"("planId");

ALTER TABLE "RsaVehicleEnrollment"
  ADD CONSTRAINT "RsaVehicleEnrollment_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RsaVehicleEnrollment"
  ADD CONSTRAINT "RsaVehicleEnrollment_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RsaVehicleEnrollment"
  ADD CONSTRAINT "RsaVehicleEnrollment_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RsaVehicleEnrollment"
  ADD CONSTRAINT "RsaVehicleEnrollment_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "RsaPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RsaVehicleEnrollment"
  ADD CONSTRAINT "RsaVehicleEnrollment_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
