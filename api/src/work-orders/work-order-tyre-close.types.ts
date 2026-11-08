import type { VehicleWheelPosition } from '@prisma/client';
import type { TireIntakeInspectionInput } from '../fleet/tires/tire-intake-inspection';

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
  /**
   * Hotel/depozitar — poate fi ≠ furnizorul WO (service).
   * Dacă lipsește la storeAt=hotel → se folosește supplierId-ul comenzii.
   */
  hotelSupplierId?: string | null;
  /** Raft/bay la check-in hotel — obligatoriu când storeAt=at_supplier_hotel. */
  locationCode?: string | null;
  /** Uzură/DOT pe pozițiile demontate — obligatoriu la close sezon. */
  demountReadings?: Array<{
    position: VehicleWheelPosition;
    treadMm: number;
    dot?: string | null;
  }>;
  intakeInspection?: TireIntakeInspectionInput;
};

/** Doar depozitare: demont (dacă e pe vehicul) + store hotel/client, fără montaj alt set. */
export type TyreCloseStorageOnly = {
  setId: string;
  storeAt: 'at_supplier_hotel' | 'at_client';
  hotelSupplierId?: string | null;
  locationCode?: string | null;
  /** Obligatoriu dacă setul e încă pe vehicul. */
  demountReadings?: Array<{
    position: VehicleWheelPosition;
    treadMm: number;
    dot?: string | null;
  }>;
  intakeInspection?: TireIntakeInspectionInput;
};

export type TyreCloseDto = {
  intent: TyreWorkIntent;
  /** Obligatoriu la close (sau pe WO odometerKmOut/In). */
  odometerKm?: number | null;
  seasonalSwap?: TyreCloseSeasonalSwap;
  storageOnly?: TyreCloseStorageOnly;
  outcomes?: TyreClosePositionOutcome[];
  /** Service jante în aceeași închidere WO (notă în payload). */
  includeRimService?: boolean;
};
