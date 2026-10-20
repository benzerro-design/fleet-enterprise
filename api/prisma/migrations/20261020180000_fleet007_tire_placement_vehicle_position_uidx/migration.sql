-- FLEET-007 / PILOT-GATE: at most one active on-vehicle placement per wheel position.
CREATE UNIQUE INDEX IF NOT EXISTS "TirePlacement_vehicle_position_active_uidx"
ON "TirePlacement" ("vehicleId", "position")
WHERE kind = 'on_vehicle'
  AND "validTo" IS NULL
  AND "vehicleId" IS NOT NULL
  AND "position" IS NOT NULL;
