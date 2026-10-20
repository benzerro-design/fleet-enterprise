import type { VehicleTireSeason } from '@prisma/client';

export type TireHubAlertKind =
  | 'tread_low'
  | 'dot_aged'
  | 'recommended_replace'
  | 'season_mismatch';

export type TireHubAlertSeverity = 'critical' | 'warning' | 'info';

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

export type TireHubSummary = {
  setsMounted: number;
  setsAtHotel: number;
  setsAtClient: number;
  assetsRecommendedReplace: number;
  assetsDotAged: number;
  assetsTreadLow: number;
};

export type SeasonReminderSyncSummary = {
  created: number;
  updated: number;
  deactivated: number;
};

export type TireHubPayload = {
  generatedAt: string;
  summary: TireHubSummary;
  alerts: TireHubAlert[];
  attentionSets: TireHubAttentionSet[];
  seasonRemindersSynced?: SeasonReminderSyncSummary;
};
