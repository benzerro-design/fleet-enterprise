export type VehicleWheelPosition = "fl" | "fr" | "rl" | "rr" | "spare";
export type VehicleTireSeason = "summer" | "winter" | "all_season" | "unknown";

export const VEHICLE_WHEEL_POSITIONS: VehicleWheelPosition[] = ["fl", "fr", "rl", "rr", "spare"];
export const VEHICLE_TIRE_SEASONS: VehicleTireSeason[] = [
  "summer",
  "winter",
  "all_season",
  "unknown",
];

export type VehicleWheelFitmentRecord = {
  id: string;
  vehicleId: string;
  position: VehicleWheelPosition;
  size: string | null;
  brand: string | null;
  season: VehicleTireSeason;
  dot: string | null;
  treadMm: number | null;
  rimSize: string | null;
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
