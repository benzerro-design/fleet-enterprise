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
  status?: 'active' | 'inactive' | 'in_maintenance' | 'decommissioned';
  odometerKm?: number;
  vin?: string | null;
  itpExpiresOn?: string | null;
  itpStationName?: string | null;
};
