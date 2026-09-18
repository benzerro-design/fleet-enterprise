export type FuelCardStatus = 'active' | 'inactive' | 'blocked';

export type PatchVehicleDto = {
  clientId?: string;
  registrationNumber?: string;
  type?:
    | 'car'
    | 'van_lt_3_5'
    | 'van_gt_3_5'
    | 'tractor_unit'
    | 'trailer'
    | 'semi_trailer';
  fuelType?: 'diesel' | 'petrol' | 'hybrid' | 'electric' | 'lpg' | null;
  status?: 'active' | 'inactive' | 'in_maintenance' | 'decommissioned';
  odometerKm?: number;
  vin?: string | null;
  brand?: string | null;
  model?: string | null;
  fuelCardNumber?: string | null;
  fuelCardProvider?: string | null;
  fuelCardAccountRef?: string | null;
  fuelCardStatus?: FuelCardStatus | null;
  itpExpiresOn?: string | null;
  itpStationName?: string | null;
  itpReminderOffsetsDays?: number[] | null;
  syncItpReminderAction?: boolean;
};
