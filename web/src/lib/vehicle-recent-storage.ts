const STORAGE_KEY = "fleet:recentVehicleIds";
const MAX_RECENT = 5;

export function readRecentVehicleIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string").slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function pushRecentVehicleId(id: string): void {
  if (typeof window === "undefined" || !id) return;
  const prev = readRecentVehicleIds().filter((x) => x !== id);
  const next = [id, ...prev].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
}
