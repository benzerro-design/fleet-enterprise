export type VehicleWheelPosition =
  | "fl"
  | "fr"
  | "rl"
  | "rr"
  | "spare"
  | "rlo"
  | "rli"
  | "rro"
  | "rri";

export type VehicleWheelLayout = "four" | "six_dual_rear";
export type VehicleTireSeason = "summer" | "winter" | "all_season" | "unknown";
export type VehicleRimMaterial = "steel" | "alloy" | "diamond_cut";

export const VEHICLE_WHEEL_LAYOUTS: VehicleWheelLayout[] = ["four", "six_dual_rear"];

export const VEHICLE_TIRE_SEASONS: VehicleTireSeason[] = [
  "summer",
  "winter",
  "all_season",
  "unknown",
];
export const VEHICLE_RIM_MATERIALS: VehicleRimMaterial[] = ["steel", "alloy", "diamond_cut"];

export const LAYOUT_POSITIONS: Record<VehicleWheelLayout, VehicleWheelPosition[]> = {
  four: ["fl", "fr", "rl", "rr", "spare"],
  six_dual_rear: ["fl", "fr", "rlo", "rli", "rro", "rri", "spare"],
};

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
  "265/50 R19",
] as const;

export const SPEED_INDEX_PRESETS = ["Q", "R", "S", "T", "H", "V", "W", "Y"] as const;

export const LOAD_INDEX_PRESETS = [
  "81",
  "84",
  "86",
  "88",
  "91",
  "94",
  "95",
  "98",
  "100",
  "102",
  "104",
  "107",
  "109",
  "110",
  "112",
  "114",
  "116",
  "118",
  "121",
] as const;

export const RIM_SIZE_PRESETS = [
  "5.5Jx14",
  "6Jx15",
  "6.5Jx16",
  "7Jx16",
  "7Jx17",
  "7.5Jx17",
  "8Jx17",
  "8Jx18",
  "8.5Jx18",
  "9Jx18",
  "9.00Jx19",
  "9Jx19",
  "10Jx20",
] as const;

export const TIRE_BRAND_PRESETS = [
  "Michelin",
  "Continental",
  "Goodyear",
  "Pirelli",
  "Bridgestone",
  "Hankook",
  "Dunlop",
  "Nokian",
  "Barum",
  "Debica",
  "Fulda",
  "Kleber",
  "Uniroyal",
  "Vredestein",
  "Yokohama",
  "Falken",
  "Sailun",
  "Triangle",
] as const;

export const TIRE_MODEL_PRESETS_BY_BRAND: Record<string, string[]> = {
  Michelin: ["Primacy 4", "CrossClimate 2", "Alpin 6", "Pilot Sport 5", "Agilis"],
  Continental: ["PremiumContact 6", "WinterContact TS 870", "EcoContact 6", "VanContact"],
  Goodyear: ["EfficientGrip", "UltraGrip", "Cargo"],
  Pirelli: ["Cinturato P7", "Scorpion", "Carrier"],
  Bridgestone: ["Turanza", "Blizzak", "Duravis"],
  Hankook: ["Ventus", "Kinergy", "Winter i*cept"],
  Dunlop: ["Sport BluResponse", "Winter Response"],
  Nokian: ["Wetproof", "Snowproof"],
};

export type VehicleWheelFitmentRecord = {
  id: string;
  vehicleId: string;
  position: VehicleWheelPosition;
  size: string | null;
  brand: string | null;
  model: string | null;
  season: VehicleTireSeason;
  speedIndex: string | null;
  loadIndex: string | null;
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
  wheelLayout?: VehicleWheelLayout;
  items: VehicleWheelFitmentRecord[];
};

export type WheelSpecDraft = {
  size: string;
  brand: string;
  model: string;
  season: VehicleTireSeason;
  speedIndex: string;
  loadIndex: string;
  commercialC: boolean;
  rimSize: string;
  rimMaterial: VehicleRimMaterial | "";
  lugNutCount: string;
};

export type WheelDraft = WheelSpecDraft & {
  dot: string;
  treadMm: string;
  notes: string;
};

/** Câmpuri copiate de bife (fără DOT / uzură / note). */
export function copySpec(from: WheelDraft): WheelSpecDraft {
  return {
    size: from.size,
    brand: from.brand,
    model: from.model,
    season: from.season,
    speedIndex: from.speedIndex,
    loadIndex: from.loadIndex,
    commercialC: from.commercialC,
    rimSize: from.rimSize,
    rimMaterial: from.rimMaterial,
    lugNutCount: from.lugNutCount,
  };
}

export function applySpec(target: WheelDraft, spec: WheelSpecDraft): WheelDraft {
  return { ...target, ...spec };
}

export function vehicleWheelLayoutLabel(l: VehicleWheelLayout): string {
  switch (l) {
    case "four":
      return "4 roți";
    case "six_dual_rear":
      return "6 roți (dual spate)";
  }
}

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
    case "rlo":
      return "Spate stânga exterior";
    case "rli":
      return "Spate stânga interior";
    case "rro":
      return "Spate dreapta exterior";
    case "rri":
      return "Spate dreapta interior";
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

export function axleGroups(layout: VehicleWheelLayout): {
  id: string;
  label: string;
  positions: VehicleWheelPosition[];
}[] {
  if (layout === "six_dual_rear") {
    return [
      { id: "front", label: "Axa față", positions: ["fl", "fr"] },
      { id: "rear", label: "Axa spate (dual)", positions: ["rlo", "rli", "rro", "rri"] },
      { id: "spare", label: "Rezervă", positions: ["spare"] },
    ];
  }
  return [
    { id: "front", label: "Axa față", positions: ["fl", "fr"] },
    { id: "rear", label: "Axa spate", positions: ["rl", "rr"] },
    { id: "spare", label: "Rezervă", positions: ["spare"] },
  ];
}

/** Perechi oglindire stânga → dreapta pe layout. */
export function mirrorPairs(
  layout: VehicleWheelLayout,
  axle: "front" | "rear",
): [VehicleWheelPosition, VehicleWheelPosition][] {
  if (axle === "front") return [["fl", "fr"]];
  if (layout === "six_dual_rear") {
    return [
      ["rlo", "rro"],
      ["rli", "rri"],
    ];
  }
  return [["rl", "rr"]];
}

export function activeCopyTargets(
  layout: VehicleWheelLayout,
  source: VehicleWheelPosition,
): VehicleWheelPosition[] {
  return LAYOUT_POSITIONS[layout].filter((p) => p !== "spare" && p !== source);
}

/**
 * Parse CIV „Anvelope/jante față|spate”:
 * ex. `265/50 R19 110 W / 9.00J X 19`
 */
export function parseCivTyreRim(raw: string): {
  size: string | null;
  loadIndex: string | null;
  speedIndex: string | null;
  rimSize: string | null;
} | null {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return null;

  const sizeMatch = text.match(/(\d{3})\s*\/\s*(\d{2})\s*R\s*(\d{2})/i);
  const normalizedSize = sizeMatch ? `${sizeMatch[1]}/${sizeMatch[2]} R${sizeMatch[3]}` : null;

  const afterSize = sizeMatch ? text.slice(sizeMatch.index! + sizeMatch[0].length) : text;
  const loadSpeed = afterSize.match(/\b(\d{2,3})\s+([A-Za-z])\b/);
  const loadIndex = loadSpeed ? loadSpeed[1] : null;
  const speedIndex = loadSpeed ? loadSpeed[2].toUpperCase() : null;

  const rimMatch = text.match(/(\d+(?:[.,]\d+)?)\s*J\s*[xX×]\s*(\d{2})/i);
  const rimSize = rimMatch ? `${rimMatch[1].replace(",", ".")}Jx${rimMatch[2]}` : null;

  if (!normalizedSize && !loadIndex && !speedIndex && !rimSize) return null;
  return { size: normalizedSize, loadIndex, speedIndex, rimSize };
}
