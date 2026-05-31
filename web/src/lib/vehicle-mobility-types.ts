export type VehicleMobilityPayload = {
  vehicleOdometerKm: number;
  fuelEvents: Array<{
    id: string;
    incurredOn: string;
    fuelLiters: number;
    odometerKm: number | null;
    provider: string | null;
  }>;
  trips: Array<{
    id: string;
    startedAt: string;
    distanceKm: number | null;
    reference: string | null;
    originLabel: string | null;
    destLabel: string | null;
  }>;
  odometerReadings: Array<{
    id: string;
    recordedAt: string;
    odometerKm: number;
    source: string;
  }>;
  summary: {
    totalTripKm: number;
    totalFuelLiters: number;
    fillCount: number;
    avgConsumptionL100: number | null;
    odometerSpanKm: number | null;
  };
  segments: Array<{
    fromDate: string;
    toDate: string;
    km: number;
    liters: number;
    l100: number;
  }>;
  monthly: Array<{
    month: string;
    tripKm: number;
    fuelLiters: number;
    fillCount: number;
  }>;
};

export function mobilitySummaryLabel(payload: VehicleMobilityPayload): string {
  const { summary } = payload;
  if (summary.fillCount === 0 && summary.totalTripKm === 0) return "Fără date încă";
  const parts: string[] = [];
  if (summary.avgConsumptionL100 != null) parts.push(`${summary.avgConsumptionL100} L/100km`);
  if (summary.totalTripKm > 0) parts.push(`${summary.totalTripKm.toLocaleString("ro-RO")} km curse`);
  if (summary.totalFuelLiters > 0) parts.push(`${summary.totalFuelLiters} L`);
  return parts.join(" · ") || "—";
}
