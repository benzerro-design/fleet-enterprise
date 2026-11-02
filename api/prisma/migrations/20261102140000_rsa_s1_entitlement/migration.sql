-- RSA-S1: snapshot entitlement pe intervenție

CREATE TYPE "RsaEntitlementStatus" AS ENUM (
  'covered',
  'partial',
  'out_of_plan',
  'pay_per_use'
);

ALTER TABLE "RoadsideIntervention"
  ADD COLUMN IF NOT EXISTS "entitlementStatus" "RsaEntitlementStatus" NOT NULL DEFAULT 'pay_per_use',
  ADD COLUMN IF NOT EXISTS "enrollmentId" TEXT,
  ADD COLUMN IF NOT EXISTS "entitlementNote" TEXT;

CREATE INDEX IF NOT EXISTS "RoadsideIntervention_enrollmentId_idx"
  ON "RoadsideIntervention"("enrollmentId");
CREATE INDEX IF NOT EXISTS "RoadsideIntervention_tenantId_entitlementStatus_idx"
  ON "RoadsideIntervention"("tenantId", "entitlementStatus");

ALTER TABLE "RoadsideIntervention"
  ADD CONSTRAINT "RoadsideIntervention_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "RsaVehicleEnrollment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
