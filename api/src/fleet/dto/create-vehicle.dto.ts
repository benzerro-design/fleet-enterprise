export type CreateVehicleDto = {
  clientId: string;
  registrationNumber: string;
  type:
    | 'car'
    | 'van_lt_3_5'
    | 'van_gt_3_5'
    | 'tractor_unit'
    | 'trailer'
    | 'semi_trailer';
  vin?: string;
  brand?: string;
  model?: string;
  odometerKm?: number;
  itpExpiresOn?: string;
  itpStationName?: string;
  itpReminderOffsetsDays?: number[] | null;
  syncItpReminderAction?: boolean;
};
