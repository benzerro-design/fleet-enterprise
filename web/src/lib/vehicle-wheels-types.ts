export type VehicleWheelPosition = "fl" | "fr" | "rl" | "rr" | "spare";
export type VehicleTireSeason = "summer" | "winter" | "all_season" | "unknown";
export type VehicleRimMaterial = "steel" | "alloy" | "diamond_cut";

export const VEHICLE_WHEEL_POSITIONS: VehicleWheelPosition[] = ["fl", "fr", "rl", "rr", "spare"];
export const VEHICLE_TIRE_SEASONS: VehicleTireSeason[] = [
  "summer",
  "winter",
  "all_season",
  "unknown",
];
export const VEHICLE_RIM_MATERIALS: VehicleRimMaterial[] = ["steel", "alloy", "diamond_cut"];

/** Dimensiuni anvelopă uzuale (preset UI). */
export const TIRE_SIZE_PRESETS = [
  "175/65 R14",
  "185/65 R15",
  "195/65 R15",
  "205/55 R16",
  "205/60 R16",
  "215/55 R17",
  "225/45 R17",
  "225/50 R17",
  "225/55 R17",
  "235/45 R18",
  "235/55 R18",
  "245/45 R18",
  "255/40 R19",
] as const;

/** Indici de viteză comuni. */
export const SPEED_INDEX_PRESETS = [
  "Q",
  "R",
  "S",
  "T",
  "H",
  "V",
  "W",
  "Y",
] as const;

export type VehicleWheelFitmentRecord = {
  id: string;
  vehicleId: string;
  position: VehicleWheelPosition;
  size: string | null;
  brand: string | null;
  model: string | null;
  season: VehicleTireSeason;
  speedIndex: string | null;
  commercialC: boolean;
  dot: string | null;
  treadMm: number | null;
  rimSize: string | null;
  rimMaterial: VehicleRimMaterial | null;
  lugNutCount: number | null;
  notes: string | null;
  updatedAt: string;
};

export type VehicleWheelsPayload = {
  items: VehicleWheelFitmentRecord[];
};

export function vehicleWheelPositionLabel(p: VehicleWheelPosition): string {
  switch (p) {
    case "fl":
      return "Față stânga";
    case "fr":
      return "Față dreapta";
    case "rl":
      return "Spate stânga";
    case "rr":
      return "Spate dreapta";
    case "spare":
      return "Rezervă";
  }
}

export function vehicleTireSeasonLabel(s: VehicleTireSeason): string {
  switch (s) {
    case "summer":
      return "Vară";
    case "winter":
      return "Iarnă";
    case "all_season":
      return "All-season";
    case "unknown":
      return "Nespecificat";
  }
}

export function vehicleRimMaterialLabel(m: VehicleRimMaterial): string {
  switch (m) {
    case "steel":
      return "Tablă";
    case "alloy":
      return "Aliaj";
    case "diamond_cut":
      return "Diamond cut";
  }
}
