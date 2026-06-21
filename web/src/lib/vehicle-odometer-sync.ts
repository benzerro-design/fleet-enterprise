export type VehicleOdometerSyncPayload = {
  updated: boolean;
  previousKm: number;
  newKm: number;
  message: string;
};

export function parseOdometerInput(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return null;
  return n;
}
