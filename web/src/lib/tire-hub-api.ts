import type { VehicleTireSeason } from "@/lib/vehicle-wheels-types";

export type TireHubAlertKind =
  | "tread_low"
  | "dot_aged"
  | "recommended_replace"
  | "season_mismatch";

export type TireHubAlertSeverity = "critical" | "warning" | "info";

export type TireHubAlert = {
  severity: TireHubAlertSeverity;
  kind: TireHubAlertKind;
  vehicleId: string;
  plate: string;
  setId?: string;
  assetId?: string;
  message: string;
  href: string;
};

export type TireHubAttentionSet = {
  vehicleId: string;
  plate: string;
  setId: string;
  setName: string | null;
  season: VehicleTireSeason;
  isMounted: boolean;
  atHotel: boolean;
  alertKinds: TireHubAlertKind[];
};

export type TireHubInventoryLocation =
  | "on_vehicle"
  | "at_supplier_hotel"
  | "at_client"
  | "other";

export type TireHubRecentEvent = {
  id: string;
  type: string;
  createdAt: string;
  odometerKm: number | null;
  workOrderId: string | null;
};

export type TireHubInventoryItem = {
  assetId: string;
  position: string | null;
  brand: string | null;
  model: string | null;
  size: string | null;
  dot: string | null;
  treadMm: number | null;
  serialOrQr: string | null;
  recommendedReplace: boolean;
  ownershipType: "client" | "fleet" | "supplier_stock";
  runFlat: boolean;
  tpmsSensorPresent: boolean;
};

export type TireHubInventorySet = {
  setId: string;
  vehicleId: string;
  plate: string;
  clientId: string;
  clientCode: string;
  clientName: string;
  setName: string | null;
  season: VehicleTireSeason;
  mountedAs: string;
  itemCount: number;
  location: TireHubInventoryLocation;
  isMounted: boolean;
  atHotel: boolean;
  stayId: string | null;
  supplierId: string | null;
  supplierName: string | null;
  locationCode: string | null;
  bayCode?: string | null;
  binCode?: string | null;
  checkInAt: string | null;
  feeCents: number | null;
  sourceSystem?: string | null;
  hrefTicket?: string | null;
  contractRef: string | null;
  intakeTreadNotes: string | null;
  photoCount: number;
  minTreadMm: number | null;
  worstDot: string | null;
  dominantBrand?: string | null;
  dominantSize?: string | null;
  itemsSeason?: VehicleTireSeason | null;
  seasonLabelMismatch?: boolean;
  assetsRecommendedReplace: number;
  hasOppositeSeasonStored: boolean;
  ownershipType: "client" | "fleet" | "supplier_stock" | "mixed" | null;
  alertKinds: TireHubAlertKind[];
  hrefWheels: string;
  hrefCreateTicket: string;
  costCentsTotal?: number;
  costCount?: number;
  lastMountKm?: number | null;
  lastDemountKm?: number | null;
  recentEvents?: TireHubRecentEvent[];
  items?: TireHubInventoryItem[];
};

export type TireHubChangeoverItem = {
  vehicleId: string;
  plate: string;
  clientCode: string;
  mountedSetId: string;
  mountedSeason: VehicleTireSeason;
  hasOppositeSeasonStored: boolean;
  recommendedSeason: "summer" | "winter";
  openWorkOrderId: string | null;
  openWorkOrderStatus: string | null;
  hrefWheels: string;
  hrefCreateTicket: string;
  hrefWorkOrder: string | null;
};

export type SeasonReminderSyncSummary = {
  created: number;
  updated: number;
  deactivated: number;
};

export type TireHubPayload = {
  generatedAt: string;
  summary: {
    setsMounted: number;
    setsAtHotel: number;
    setsAtClient: number;
    assetsRecommendedReplace: number;
    assetsDotAged: number;
    assetsTreadLow: number;
  };
  alerts: TireHubAlert[];
  attentionSets: TireHubAttentionSet[];
  inventorySets?: TireHubInventorySet[];
  changeoverQueue?: TireHubChangeoverItem[];
  seasonRemindersSynced?: SeasonReminderSyncSummary;
};

export function tireHubAlertKindLabel(kind: TireHubAlertKind): string {
  switch (kind) {
    case "tread_low":
      return "Uzură";
    case "dot_aged":
      return "DOT";
    case "recommended_replace":
      return "Înlocuire";
    case "season_mismatch":
      return "Sezon";
  }
}

export function tireHubLocationLabel(loc: TireHubInventoryLocation): string {
  switch (loc) {
    case "on_vehicle":
      return "Montat";
    case "at_supplier_hotel":
      return "Hotel";
    case "at_client":
      return "La client";
    case "other":
      return "Altele";
  }
}

export function tireEventTypeLabel(type: string): string {
  const map: Record<string, string> = {
    purchase: "Achiziție",
    mount: "Montaj",
    demount: "Demontaj",
    rotate: "Rotație",
    inspect: "Inspecție",
    repair: "Reparație",
    store: "Depozitare",
    release: "Eliberare",
    scrap: "Casare",
    transfer: "Transfer",
  };
  return map[type] ?? type;
}
