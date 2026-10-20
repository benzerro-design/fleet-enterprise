import type { VehicleWheelPosition } from '@prisma/client';

export const TYRE_WORK_INTENTS = [
  'purchase',
  'roadside_puncture',
  'seasonal_changeover',
  'diagnostic_wheel',
  'rim_service',
  'storage_only',
  'eol_replace',
] as const;

export type TyreWorkIntent = (typeof TYRE_WORK_INTENTS)[number];

export type TyrePositionOutcomeKind =
  | 'repaired'
  | 'replaced'
  | 'inspected_ok'
  | 'deferred'
  | 'seasonal_swap';

export type TyreCloseNewAssetInput = {
  size?: string | null;
  brand?: string | null;
  model?: string | null;
  season?: string | null;
  dot?: string | null;
  treadMm?: number | null;
  speedIndex?: string | null;
  loadIndex?: string | null;
  commercialC?: boolean;
};

export type TyreClosePositionOutcome = {
  position: VehicleWheelPosition;
  outcome: TyrePositionOutcomeKind;
  treadMm?: number | null;
  dot?: string | null;
  newAsset?: TyreCloseNewAssetInput;
  /** replaced: scrap (default) vs quarantine */
  disposeAs?: 'scrap' | 'quarantine';
};

export type TyreCloseSeasonalSwap = {
  demountSetId: string;
  mountSetId: string;
  storeAt: 'at_supplier_hotel' | 'at_client';
};

export type TyreCloseDto = {
  intent: TyreWorkIntent;
  odometerKm?: number | null;
  seasonalSwap?: TyreCloseSeasonalSwap;
  outcomes?: TyreClosePositionOutcome[];
};
