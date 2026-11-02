-- RSA-S4 remediere: snapshot plan pe intervenție + rate card pe misiune.

ALTER TABLE "RoadsideIntervention" ADD COLUMN IF NOT EXISTS "entitlementIncludedTowKm" INTEGER;
ALTER TABLE "RoadsideIntervention" ADD COLUMN IF NOT EXISTS "entitlementOveragePerKmCents" INTEGER;

ALTER TABLE "RsaTowMission" ADD COLUMN IF NOT EXISTS "rateCardSnapshotJson" JSONB;

-- Backfill plan bits pe intervențiile existente cu enrollment.
UPDATE "RoadsideIntervention" AS ri
SET
  "entitlementIncludedTowKm" = p."includedTowKm",
  "entitlementOveragePerKmCents" = p."overagePerKmCents"
FROM "RsaVehicleEnrollment" AS e
JOIN "RsaPlan" AS p ON p."id" = e."planId"
WHERE ri."enrollmentId" = e."id"
  AND ri."entitlementIncludedTowKm" IS NULL
  AND ri."entitlementOveragePerKmCents" IS NULL;

-- Backfill rate card pe misiunile fără snapshot.
UPDATE "RsaTowMission" AS m
SET "rateCardSnapshotJson" = jsonb_build_object(
  'baseCalloutOutPlanCents', COALESCE(sp."baseCalloutOutPlanCents", 0),
  'towHookOutPlanCents', COALESCE(sp."towHookOutPlanCents", 0),
  'towPerKmOutPlanCents', COALESCE(sp."towPerKmOutPlanCents", 0),
  'winchSurchargeCents', COALESCE(sp."winchSurchargeCents", 0),
  'nightWeekendMultiplierPct', COALESCE(sp."nightWeekendMultiplierPct", 0)
)
FROM "RsaSupplierProfile" AS sp
WHERE sp."supplierId" = m."supplierId"
  AND m."rateCardSnapshotJson" IS NULL;
