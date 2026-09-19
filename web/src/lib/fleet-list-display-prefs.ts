export type FleetListDensity = "detailed" | "simple";

export type FleetListDisplayPrefs = {
  density: FleetListDensity;
  /** Pe listă simplă / tabel: linie fină între rânduri. */
  rowDividers: boolean;
};

export const FLEET_LIST_DISPLAY_STORAGE_KEY = "fleet-list-display-v1";

export const DEFAULT_FLEET_LIST_DISPLAY_PREFS: FleetListDisplayPrefs = {
  density: "detailed",
  rowDividers: true,
};

export function readFleetListDisplayPrefs(): FleetListDisplayPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_FLEET_LIST_DISPLAY_PREFS };
  try {
    const raw = localStorage.getItem(FLEET_LIST_DISPLAY_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FLEET_LIST_DISPLAY_PREFS };
    const parsed = JSON.parse(raw) as Partial<FleetListDisplayPrefs>;
    return {
      density: parsed.density === "simple" ? "simple" : "detailed",
      rowDividers: parsed.rowDividers !== false,
    };
  } catch {
    return { ...DEFAULT_FLEET_LIST_DISPLAY_PREFS };
  }
}

export function writeFleetListDisplayPrefs(prefs: FleetListDisplayPrefs): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FLEET_LIST_DISPLAY_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota */
  }
}
