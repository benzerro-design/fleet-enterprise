import type { FuelType } from '@prisma/client';

export type ConsumptionTripRow = {
  id: string;
  vehicleId: string;
  registrationNumber: string;
  clientId: string;
  startedAt: string;
  endedAt: string | null;
  reference: string | null;
  originLabel: string | null;
  destLabel: string | null;
  distanceKm: number | null;
  odometerStartKm: number | null;
  odometerEndKm: number | null;
};

export type ConsumptionFillRow = {
  id: string;
  vehicleId: string;
  registrationNumber: string;
  clientId: string;
  incurredOn: string;
  fuelLiters: number;
  fuelProductType: FuelType | null;
  fuelProductLabel: string;
  odometerKm: number | null;
  amountCents: number;
  provider: string | null;
};

export type ConsumptionSegmentRow = {
  vehicleId: string;
  registrationNumber: string;
  fillId: string;
  fillAt: string;
  fillLiters: number;
  fillOdometerKm: number | null;
  fuelProductType: FuelType | null;
  fuelProductLabel: string;
  periodStart: string;
  periodEnd: string;
  kmDelta: number;
  l100: number;
};

export type ConsumptionWeeklyBucket = {
  weekLabel: string;
  weekStart: string;
  tripKm: number;
  odometerKm: number | null;
  fuelLiters: number;
};

export type ConsumptionFuelMixRow = {
  fuelProductType: FuelType | null;
  label: string;
  liters: number;
};

export type ConsumptionFuelTypeSummary = {
  fuelType: FuelType;
  label: string;
  energyUnit: 'L' | 'kWh';
  totalTripKm: number;
  totalEnergy: number;
  totalFuelCostCents: number;
  avgConsumptionPer100: number | null;
  segmentCount: number;
  tripCount: number;
  fillCount: number;
  vehicleCount: number;
};

export type ConsumptionSummary = {
  totalTripKm: number;
  totalFuelLiters: number;
  totalFuelCostCents: number;
  avgSegmentL100: number | null;
  segmentCount: number;
  tripCount: number;
  fillCount: number;
  kmReconciliationPct: number | null;
  qualityWarnings: string[];
};

export type ConsumptionPayload = {
  periodStart: string;
  periodEnd: string;
  vehicleScope: 'all' | 'selected';
  selectedVehicleCount: number;
  fuelTypeFilter: FuelType[] | null;
  summary: ConsumptionSummary;
  summaryByFuelType: ConsumptionFuelTypeSummary[];
  weekly: ConsumptionWeeklyBucket[];
  fuelMix: ConsumptionFuelMixRow[];
  trips: ConsumptionTripRow[];
  fills: ConsumptionFillRow[];
  segments: ConsumptionSegmentRow[];
};
