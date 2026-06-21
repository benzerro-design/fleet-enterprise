export type VehicleOdometerSyncPayload = {
  updated: boolean;
  previousKm: number;
  newKm: number;
  message: string;
};

export type OpsOdometerEntity = 'cost' | 'maintenance' | 'trip';
