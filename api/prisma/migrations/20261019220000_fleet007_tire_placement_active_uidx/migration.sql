-- FLEET-007: at most one active (validTo IS NULL) placement per tire asset.
CREATE UNIQUE INDEX IF NOT EXISTS "TirePlacement_asset_active_uidx"
ON "TirePlacement" ("assetId") WHERE "validTo" IS NULL;
