import { isFuelCostCategory } from '../ops/fuel-ops';
import type {
  MobilityFuelSegment,
  MobilityMonthlyBucket,
  VehicleMobilityPayload,
} from './vehicle-mobility.types';

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function buildVehicleMobilityPayload(input: {
  vehicleOdometerKm: number;
  costs: Array<{
    id: string;
    category: string;
    incurredOn: Date;
    fuelLiters: number | null;
    odometerKm: number | null;
    provider: string | null;
  }>;
  trips: Array<{
    id: string;
    startedAt: Date;
    distanceKm: number | null;
    reference: string | null;
    originLabel: string | null;
    destLabel: string | null;
  }>;
  odometerReadings: Array<{
    id: string;
    recordedAt: Date;
    odometerKm: number;
    source: string;
  }>;
}): VehicleMobilityPayload {
  const fuelEvents = input.costs
    .filter((c) => isFuelCostCategory(c.category) && c.fuelLiters != null && c.fuelLiters > 0)
    .map((c) => ({
      id: c.id,
      incurredOn: c.incurredOn.toISOString(),
      fuelLiters: c.fuelLiters!,
      odometerKm: c.odometerKm,
      provider: c.provider,
    }))
    .sort((a, b) => a.incurredOn.localeCompare(b.incurredOn));

  const trips = input.trips
    .map((t) => ({
      id: t.id,
      startedAt: t.startedAt.toISOString(),
      distanceKm: t.distanceKm,
      reference: t.reference,
      originLabel: t.originLabel,
      destLabel: t.destLabel,
    }))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  const odometerReadings = input.odometerReadings
    .map((r) => ({
      id: r.id,
      recordedAt: r.recordedAt.toISOString(),
      odometerKm: r.odometerKm,
      source: r.source,
    }))
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));

  const totalTripKm = input.trips.reduce((s, t) => s + (t.distanceKm ?? 0), 0);
  const totalFuelLiters = fuelEvents.reduce((s, f) => s + f.fuelLiters, 0);

  const segments: MobilityFuelSegment[] = [];
  const withOdo = fuelEvents.filter((f) => f.odometerKm != null && f.odometerKm > 0);
  for (let i = 1; i < withOdo.length; i++) {
    const prev = withOdo[i - 1]!;
    const curr = withOdo[i]!;
    const km = curr.odometerKm! - prev.odometerKm!;
    const liters = curr.fuelLiters;
    if (km > 0 && liters > 0) {
      segments.push({
        fromDate: prev.incurredOn,
        toDate: curr.incurredOn,
        km,
        liters,
        l100: round1((liters / km) * 100),
      });
    }
  }

  const avgConsumptionL100 =
    segments.length > 0
      ? round1(segments.reduce((s, seg) => s + seg.l100, 0) / segments.length)
      : null;

  const readingsAsc = [...input.odometerReadings].sort(
    (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime(),
  );
  const odometerSpanKm =
    readingsAsc.length >= 2
      ? readingsAsc[readingsAsc.length - 1]!.odometerKm - readingsAsc[0]!.odometerKm
      : null;

  const monthlyMap = new Map<string, MobilityMonthlyBucket>();
  for (const t of input.trips) {
    if (t.distanceKm == null || t.distanceKm <= 0) continue;
    const key = monthKey(t.startedAt);
    const bucket = monthlyMap.get(key) ?? { month: key, tripKm: 0, fuelLiters: 0, fillCount: 0 };
    bucket.tripKm += t.distanceKm;
    monthlyMap.set(key, bucket);
  }
  for (const f of fuelEvents) {
    const key = monthKey(new Date(f.incurredOn));
    const bucket = monthlyMap.get(key) ?? { month: key, tripKm: 0, fuelLiters: 0, fillCount: 0 };
    bucket.fuelLiters += f.fuelLiters;
    bucket.fillCount += 1;
    monthlyMap.set(key, bucket);
  }

  const monthly = [...monthlyMap.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12);

  return {
    vehicleOdometerKm: input.vehicleOdometerKm,
    fuelEvents: fuelEvents.reverse(),
    trips,
    odometerReadings,
    summary: {
      totalTripKm,
      totalFuelLiters: round1(totalFuelLiters),
      fillCount: fuelEvents.length,
      avgConsumptionL100,
      odometerSpanKm,
    },
    segments: segments.reverse(),
    monthly,
  };
}
