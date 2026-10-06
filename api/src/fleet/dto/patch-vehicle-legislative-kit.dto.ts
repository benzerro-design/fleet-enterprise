import {
  EMPTY_LEGISLATIVE_KIT,
  normalizeLegislativeKit,
  type VehicleLegislativeKit,
} from './vehicle-legislative-kit.shared';

export type { VehicleLegislativeKit };
export { EMPTY_LEGISLATIVE_KIT, normalizeLegislativeKit };

export type PatchVehicleLegislativeKitDto = {
  extinguisher?: { type?: string | null; expiresOn?: string | null };
  medicalKit?: { type?: string | null; expiresOn?: string | null };
  punctureKitPresent?: boolean;
  triangle?: { present?: boolean; quantity?: number | null };
  vest?: { present?: boolean; quantity?: number | null };
  notes?: string | null;
};
