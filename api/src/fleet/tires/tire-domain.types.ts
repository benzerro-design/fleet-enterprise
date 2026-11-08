import type {
  TireMountedAs,
  VehicleRimMaterial,
  VehicleTireSeason,
  VehicleWheelPosition,
} from '@prisma/client';

export const TIRE_SET_QR_PREFIX = 'FE:tire-set:';
export const TIRE_SHELF_QR_PREFIX = 'FE:tire-shelf:';

export function tireSetQrPayload(setId: string): string {
  return `${TIRE_SET_QR_PREFIX}${setId}`;
}

export function tireShelfQrPayload(shelfId: string): string {
  return `${TIRE_SHELF_QR_PREFIX}${shelfId}`;
}

/** Majority season for a set — unknown if mixed or empty. */
export function pickSetSeason(seasons: VehicleTireSeason[]): VehicleTireSeason {
  const known = seasons.filter((s) => s !== 'unknown');
  if (known.length === 0) return 'unknown';
  const first = known[0]!;
  return known.every((s) => s === first) ? first : 'unknown';
}

/** Plate search field may contain FE:tire-set:{id} or a raw set id (cuid). */
export function parseTireSetSearchInput(raw: string): { kind: 'setId'; setId: string } | { kind: 'plate'; plate: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { kind: 'plate', plate: '' };
  }
  const upper = trimmed.toUpperCase();
  if (upper.startsWith(TIRE_SET_QR_PREFIX.toUpperCase())) {
    const setId = trimmed.slice(TIRE_SET_QR_PREFIX.length).trim();
    if (setId) return { kind: 'setId', setId };
  }
  if (/^c[a-z0-9]{20,}$/i.test(trimmed)) {
    return { kind: 'setId', setId: trimmed };
  }
  const plate = trimmed.replace(/\s+/g, '').toUpperCase();
  return { kind: 'plate', plate };
}

/** Live field formatting: upper-case plates only; preserve set id / QR id casing. */
export function formatTireSetSearchFieldOnChange(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return raw;

  if (trimmed.toUpperCase().startsWith(TIRE_SET_QR_PREFIX.toUpperCase())) {
    const lead = raw.match(/^\s*/)?.[0] ?? '';
    const body = raw.slice(lead.length);
    const prefixMatch = body.match(/^FE:tire-set:/i);
    if (prefixMatch) {
      const idPart = body.slice(prefixMatch[0].length);
      return lead + TIRE_SET_QR_PREFIX + idPart;
    }
  }

  const parsed = parseTireSetSearchInput(raw);
  if (parsed.kind === 'setId') return raw;

  const compact = trimmed.replace(/\s+/g, '');
  if (/^c[a-z0-9]*$/i.test(compact)) return raw;

  return raw.toUpperCase();
}

export type TireSetHotelBadge = {
  atSupplierHotel: boolean;
  supplierName?: string | null;
  locationCode?: string | null;
  checkInAt?: string | null;
  stayId?: string | null;
};

export type TireSetLocation = 'on_vehicle' | 'at_supplier_hotel' | 'at_client' | 'other';

export type TireSetItemPreview = {
  assetId: string;
  position: string | null;
  brand: string | null;
  model: string | null;
  size: string | null;
  season: VehicleTireSeason;
  treadMm: number | null;
  dot: string | null;
};

export type TireSetSummary = {
  id: string;
  season: VehicleTireSeason;
  name: string | null;
  mountedAs: TireMountedAs;
  archivedAt: string | null;
  itemCount: number;
  isMounted: boolean;
  location: TireSetLocation;
  hotel?: TireSetHotelBadge | null;
  qrPayload?: string;
  /** Majority season of tire assets in the set (may differ from set.season). */
  itemsSeason?: VehicleTireSeason | null;
  /** True when set.season disagrees with unanimous non-unknown asset seasons. */
  seasonMismatch?: boolean;
  dominantBrand?: string | null;
  dominantModel?: string | null;
  dominantSize?: string | null;
  photoUrls?: string[];
  photoCount?: number;
  hrefInventar?: string;
  hrefSeasonTicket?: string;
  hrefHotelTicket?: string;
  items?: TireSetItemPreview[];
};

export type TireSetSeedFrom = 'mounted_specs' | 'empty';

export type CreateTireSetDto = {
  season: VehicleTireSeason;
  name?: string | null;
  mountedAs?: TireMountedAs;
  seedFrom?: TireSetSeedFrom;
};

export type FitmentSyncFields = {
  size?: string | null;
  brand?: string | null;
  model?: string | null;
  season?: VehicleTireSeason;
  speedIndex?: string | null;
  loadIndex?: string | null;
  commercialC?: boolean;
  dot?: string | null;
  treadMm?: number | null;
  rimSize?: string | null;
  rimMaterial?: VehicleRimMaterial | null;
  lugNutCount?: number | null;
};

export type PlaceAssetParams = {
  tenantId: string;
  assetId: string;
  kind: import('@prisma/client').TirePlacementKind;
  vehicleId?: string | null;
  position?: VehicleWheelPosition | null;
  supplierId?: string | null;
  locationCode?: string | null;
  setId?: string | null;
  eventType?: import('@prisma/client').TireEventType;
  vehicleIdForEvent?: string | null;
  actorUserId?: string | null;
  workOrderId?: string | null;
  odometerKm?: number | null;
  payload?: import('@prisma/client').Prisma.InputJsonValue | null;
};

export const POSITION_SORT_ORDER: VehicleWheelPosition[] = [
  'fl',
  'fr',
  'rl',
  'rr',
  'rlo',
  'rli',
  'rro',
  'rri',
  'spare',
];

export function positionSortIndex(position: VehicleWheelPosition): number {
  const idx = POSITION_SORT_ORDER.indexOf(position);
  return idx >= 0 ? idx : 99;
}
