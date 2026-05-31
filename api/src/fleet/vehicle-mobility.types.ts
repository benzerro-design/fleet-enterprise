export type MobilityFuelEvent = {
  id: string;
  incurredOn: string;
  fuelLiters: number;
  odometerKm: number | null;
  provider: string | null;
};

export type MobilityTripRow = {
  id: string;
  startedAt: string;
  distanceKm: number | null;
  reference: string | null;
  originLabel: string | null;
  destLabel: string | null;
};

export type MobilityOdometerRow = {
  id: string;
  recordedAt: string;
  odometerKm: number;
  source: string;
};

export type MobilityFuelSegment = {
  fromDate: string;
  toDate: string;
  km: number;
  liters: number;
  l100: number;
};

export type MobilityMonthlyBucket = {
  month: string;
  tripKm: number;
  fuelLiters: number;
  fillCount: number;
};

export type VehicleMobilityPayload = {
  vehicleOdometerKm: number;
  fuelEvents: MobilityFuelEvent[];
  trips: MobilityTripRow[];
  odometerReadings: MobilityOdometerRow[];
  summary: {
    totalTripKm: number;
    totalFuelLiters: number;
    fillCount: number;
    avgConsumptionL100: number | null;
    odometerSpanKm: number | null;
  };
  segments: MobilityFuelSegment[];
  monthly: MobilityMonthlyBucket[];
};
