import type { TireOwnershipType, VehicleTireSeason } from '@prisma/client';

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

/** Locatie operațională a setului pe hub (control tower). */
export type TireHubInventoryLocation =
  | 'on_vehicle'
  | 'at_supplier_hotel'
  | 'at_client'
  | 'other';

/** Anvelopă individuală în set — inventar avansat. */
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
  ownershipType: TireOwnershipType;
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
  /** Brand dominant dacă toate items au același brand. */
  dominantBrand: string | null;
  /** Size dominant dacă toate items au același size. */
  dominantSize: string | null;
  /** Majority asset season — may differ from set.season after fitment edits. */
  itemsSeason: VehicleTireSeason | null;
  /** set.season disagrees with unanimous asset seasons. */
  seasonLabelMismatch: boolean;
  assetsRecommendedReplace: number;
  hasOppositeSeasonStored: boolean;
  ownershipType: TireOwnershipType | 'mixed' | null;
  alertKinds: TireHubAlertKind[];
  hrefWheels: string;
  hrefCreateTicket: string;
  /** Sumă CostEntry legate de set (cents). */
  costCentsTotal: number;
  costCount: number;
  lastMountKm: number | null;
  lastDemountKm: number | null;
  recentEvents: TireHubRecentEvent[];
  items: TireHubInventoryItem[];
};

/** Ultimele evenimente pe set (mount/demount/store/…). */
export type TireHubRecentEvent = {
  id: string;
  type: string;
  createdAt: string;
  odometerKm: number | null;
  workOrderId: string | null;
};

/** Coadă schimb sezon — mismatch + eventual WO tip R deschis. */
export type TireHubChangeoverItem = {
  vehicleId: string;
  plate: string;
  clientCode: string;
  mountedSetId: string;
  mountedSeason: VehicleTireSeason;
  hasOppositeSeasonStored: boolean;
  recommendedSeason: 'summer' | 'winter';
  openWorkOrderId: string | null;
  openWorkOrderStatus: string | null;
  hrefWheels: string;
  hrefCreateTicket: string;
  hrefWorkOrder: string | null;
};

export type TireHubPayload = {
  generatedAt: string;
  summary: TireHubSummary;
  alerts: TireHubAlert[];
  attentionSets: TireHubAttentionSet[];
  /** Inventar flotă — o linie = un TireSet în scope. */
  inventorySets: TireHubInventorySet[];
  /** Vehicule cu sezon greșit montat (control tower changeover). */
  changeoverQueue: TireHubChangeoverItem[];
  seasonRemindersSynced?: SeasonReminderSyncSummary;
};
