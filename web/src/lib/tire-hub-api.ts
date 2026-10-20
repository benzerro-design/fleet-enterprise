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
