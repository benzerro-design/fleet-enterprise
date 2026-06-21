import type { FuelType } from '@prisma/client';
import { fuelEnergyUnit } from '../fleet/vehicle-fuel-resolve';
import { isFuelCostCategory } from './fuel-ops';
import { fuelTypeLabel } from './fuel-types';
import type {
  ConsumptionFillRow,
  ConsumptionFuelMixRow,
  ConsumptionFuelTypeSummary,
  ConsumptionPayload,
  ConsumptionSegmentRow,
  ConsumptionSummary,
  ConsumptionTripRow,
  ConsumptionWeeklyBucket,
} from './consumption.types';

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function weekIndex(date: Date, periodStart: Date): number {
  const ms = date.getTime() - periodStart.getTime();
  if (ms < 0) return 0;
  return Math.floor(ms / (7 * 24 * 60 * 60 * 1000));
}

function buildWeeklyBuckets(
  periodStart: Date,
  periodEnd: Date,
  trips: Array<{ startedAt: Date; distanceKm: number | null }>,
  fills: Array<{ incurredOn: Date; fuelLiters: number }>,
  readings: Array<{ recordedAt: Date; odometerKm: number }>,
): ConsumptionWeeklyBucket[] {
  const totalWeeks = Math.max(1, weekIndex(periodEnd, periodStart) + 1);
  const buckets: ConsumptionWeeklyBucket[] = [];
  for (let i = 0; i < totalWeeks; i++) {
    const weekStart = new Date(periodStart.getTime() + i * 7 * 24 * 60 * 60 * 1000);
    buckets.push({
      weekLabel: `S${i + 1}`,
      weekStart: weekStart.toISOString(),
      tripKm: 0,
      odometerKm: null,
      fuelLiters: 0,
    });
  }

  for (const t of trips) {
    const idx = weekIndex(t.startedAt, periodStart);
    if (idx >= 0 && idx < buckets.length && t.distanceKm != null && t.distanceKm > 0) {
      buckets[idx]!.tripKm += t.distanceKm;
    }
  }

  for (const f of fills) {
    const idx = weekIndex(f.incurredOn, periodStart);
    if (idx >= 0 && idx < buckets.length) {
      buckets[idx]!.fuelLiters += f.fuelLiters;
    }
  }

  const readingsAsc = [...readings].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  for (let i = 0; i < buckets.length; i++) {
    const weekStart = new Date(periodStart.getTime() + i * 7 * 24 * 60 * 60 * 1000);
    const weekEnd =
      i + 1 < buckets.length
        ? new Date(periodStart.getTime() + (i + 1) * 7 * 24 * 60 * 60 * 1000 - 1)
        : periodEnd;
    const inWeek = readingsAsc.filter(
      (r) => r.recordedAt >= weekStart && r.recordedAt <= weekEnd,
    );
    if (inWeek.length >= 2) {
      buckets[i]!.odometerKm = Math.max(...inWeek.map((r) => r.odometerKm)) - Math.min(...inWeek.map((r) => r.odometerKm));
    } else if (inWeek.length === 1 && readingsAsc.length >= 2) {
      const idxReading = readingsAsc.findIndex((r) => r.recordedAt.getTime() === inWeek[0]!.recordedAt.getTime());
      const prev = idxReading > 0 ? readingsAsc[idxReading - 1] : null;
      const next = idxReading >= 0 && idxReading < readingsAsc.length - 1 ? readingsAsc[idxReading + 1] : null;
      if (prev && inWeek[0]!.recordedAt >= weekStart) {
        buckets[i]!.odometerKm = inWeek[0]!.odometerKm - prev.odometerKm;
      } else if (next && inWeek[0]!.recordedAt <= weekEnd) {
        buckets[i]!.odometerKm = next.odometerKm - inWeek[0]!.odometerKm;
      }
    }
  }

  return buckets.map((b) => ({
    ...b,
    tripKm: b.tripKm,
    fuelLiters: round1(b.fuelLiters),
    odometerKm: b.odometerKm != null && b.odometerKm > 0 ? b.odometerKm : null,
  }));
}

function buildFuelMix(fills: ConsumptionFillRow[]): ConsumptionFuelMixRow[] {
  const map = new Map<string, ConsumptionFuelMixRow>();
  for (const f of fills) {
    const key = f.fuelProductType ?? 'unknown';
    const existing = map.get(key) ?? {
      fuelProductType: f.fuelProductType,
      label: f.fuelProductLabel,
      liters: 0,
    };
    existing.liters += f.fuelLiters;
    map.set(key, existing);
  }
  return [...map.values()]
    .map((r) => ({ ...r, liters: round1(r.liters) }))
    .sort((a, b) => b.liters - a.liters);
}

function buildSegments(
  allFills: ConsumptionFillRow[],
  periodStart: Date,
  periodEnd: Date,
): ConsumptionSegmentRow[] {
  const byVehicle = new Map<string, ConsumptionFillRow[]>();
  for (const f of allFills) {
    const list = byVehicle.get(f.vehicleId) ?? [];
    list.push(f);
    byVehicle.set(f.vehicleId, list);
  }

  const segments: ConsumptionSegmentRow[] = [];
  for (const fills of byVehicle.values()) {
    const sorted = [...fills].sort((a, b) => a.incurredOn.localeCompare(b.incurredOn));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const curr = sorted[i]!;
      if (prev.odometerKm == null || curr.odometerKm == null) continue;
      const kmDelta = curr.odometerKm - prev.odometerKm;
      if (kmDelta <= 0 || curr.fuelLiters <= 0) continue;
      const fillAt = new Date(curr.incurredOn);
      if (fillAt < periodStart || fillAt > periodEnd) continue;
      segments.push({
        vehicleId: curr.vehicleId,
        registrationNumber: curr.registrationNumber,
        fillId: curr.id,
        fillAt: curr.incurredOn,
        fillLiters: curr.fuelLiters,
        fillOdometerKm: curr.odometerKm,
        fuelProductType: curr.fuelProductType,
        fuelProductLabel: curr.fuelProductLabel,
        periodStart: prev.incurredOn,
        periodEnd: curr.incurredOn,
        kmDelta,
        l100: round1((curr.fuelLiters / kmDelta) * 100),
      });
    }
  }

  return segments.sort((a, b) => a.fillAt.localeCompare(b.fillAt));
}

function buildSummaryByFuelType(input: {
  trips: ConsumptionTripRow[];
  fills: ConsumptionFillRow[];
  segments: ConsumptionSegmentRow[];
  vehicleFuelById: Map<string, FuelType | null>;
}): ConsumptionFuelTypeSummary[] {
  const types = new Set<FuelType>();
  for (const ft of input.vehicleFuelById.values()) {
    if (ft) types.add(ft);
  }
  for (const f of input.fills) {
    if (f.fuelProductType) types.add(f.fuelProductType);
  }

  const summaries: ConsumptionFuelTypeSummary[] = [];
  for (const fuelType of [...types].sort()) {
    const vehicleIds = [...input.vehicleFuelById.entries()]
      .filter(([, ft]) => ft === fuelType)
      .map(([id]) => id);
    const vehicleIdSet = new Set(vehicleIds);

    const trips = input.trips.filter((t) => vehicleIdSet.has(t.vehicleId));
    const fills = input.fills.filter((f) => vehicleIdSet.has(f.vehicleId));
    const segments = input.segments.filter((s) => vehicleIdSet.has(s.vehicleId));

    const totalTripKm = trips.reduce((s, t) => s + (t.distanceKm ?? 0), 0);
    const totalEnergy = fills.reduce((s, f) => s + f.fuelLiters, 0);
    const totalFuelCostCents = fills.reduce((s, f) => s + f.amountCents, 0);
    const avgConsumptionPer100 =
      segments.length > 0
        ? round1(segments.reduce((s, seg) => s + seg.l100, 0) / segments.length)
        : null;

    summaries.push({
      fuelType,
      label: fuelTypeLabel(fuelType),
      energyUnit: fuelEnergyUnit(fuelType),
      totalTripKm,
      totalEnergy: round1(totalEnergy),
      totalFuelCostCents,
      avgConsumptionPer100,
      segmentCount: segments.length,
      tripCount: trips.length,
      fillCount: fills.length,
      vehicleCount: vehicleIds.length,
    });
  }

  return summaries.sort((a, b) => b.totalEnergy - a.totalEnergy);
}

export function buildConsumptionPayload(input: {
  periodStart: Date;
  periodEnd: Date;
  vehicleScope: 'all' | 'selected';
  selectedVehicleCount: number;
  fuelTypeFilter: FuelType[] | null;
  vehicleFuelById: Map<string, FuelType | null>;
  trips: Array<{
    id: string;
    vehicleId: string;
    registrationNumber: string;
    clientId: string;
    startedAt: Date;
    endedAt: Date | null;
    reference: string | null;
    originLabel: string | null;
    destLabel: string | null;
    distanceKm: number | null;
    odometerStartKm: number | null;
    odometerEndKm: number | null;
  }>;
  costs: Array<{
    id: string;
    vehicleId: string;
    registrationNumber: string;
    clientId: string;
    category: string;
    incurredOn: Date;
    fuelLiters: number | null;
    fuelProductType: FuelType | null;
    odometerKm: number | null;
    amountCents: number;
    provider: string | null;
  }>;
  allFuelCostsForSegments: Array<{
    id: string;
    vehicleId: string;
    registrationNumber: string;
    clientId: string;
    category: string;
    incurredOn: Date;
    fuelLiters: number | null;
    fuelProductType: FuelType | null;
    odometerKm: number | null;
    amountCents: number;
    provider: string | null;
  }>;
  odometerReadings: Array<{ recordedAt: Date; odometerKm: number }>;
}): ConsumptionPayload {
  const tripRows: ConsumptionTripRow[] = input.trips.map((t) => ({
    id: t.id,
    vehicleId: t.vehicleId,
    registrationNumber: t.registrationNumber,
    clientId: t.clientId,
    startedAt: t.startedAt.toISOString(),
    endedAt: t.endedAt ? t.endedAt.toISOString() : null,
    reference: t.reference,
    originLabel: t.originLabel,
    destLabel: t.destLabel,
    distanceKm: t.distanceKm,
    odometerStartKm: t.odometerStartKm,
    odometerEndKm: t.odometerEndKm,
  }));

  const fillsInPeriod: ConsumptionFillRow[] = input.costs
    .filter((c) => isFuelCostCategory(c.category) && c.fuelLiters != null && c.fuelLiters > 0)
    .map((c) => ({
      id: c.id,
      vehicleId: c.vehicleId,
      registrationNumber: c.registrationNumber,
      clientId: c.clientId,
      incurredOn: c.incurredOn.toISOString(),
      fuelLiters: round1(c.fuelLiters!),
      fuelProductType: c.fuelProductType,
      fuelProductLabel: fuelTypeLabel(c.fuelProductType),
      odometerKm: c.odometerKm,
      amountCents: c.amountCents,
      provider: c.provider,
    }))
    .sort((a, b) => b.incurredOn.localeCompare(a.incurredOn));

  const allFillRows: ConsumptionFillRow[] = input.allFuelCostsForSegments
    .filter((c) => isFuelCostCategory(c.category) && c.fuelLiters != null && c.fuelLiters > 0)
    .map((c) => ({
      id: c.id,
      vehicleId: c.vehicleId,
      registrationNumber: c.registrationNumber,
      clientId: c.clientId,
      incurredOn: c.incurredOn.toISOString(),
      fuelLiters: round1(c.fuelLiters!),
      fuelProductType: c.fuelProductType,
      fuelProductLabel: fuelTypeLabel(c.fuelProductType),
      odometerKm: c.odometerKm,
      amountCents: c.amountCents,
      provider: c.provider,
    }));

  const segments = buildSegments(allFillRows, input.periodStart, input.periodEnd);

  const totalTripKm = input.trips.reduce((s, t) => s + (t.distanceKm ?? 0), 0);
  const totalFuelLiters = fillsInPeriod.reduce((s, f) => s + f.fuelLiters, 0);
  const totalFuelCostCents = fillsInPeriod.reduce((s, f) => s + f.amountCents, 0);

  const readingsAsc = [...input.odometerReadings].sort(
    (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime(),
  );
  const odometerSpanKm =
    readingsAsc.length >= 2
      ? readingsAsc[readingsAsc.length - 1]!.odometerKm - readingsAsc[0]!.odometerKm
      : null;

  let kmReconciliationPct: number | null = null;
  if (odometerSpanKm != null && odometerSpanKm > 0 && totalTripKm > 0) {
    kmReconciliationPct = round1(((totalTripKm - odometerSpanKm) / odometerSpanKm) * 100);
  }

  const qualityWarnings: string[] = [];
  const fillsNoOdo = fillsInPeriod.filter((f) => f.odometerKm == null || f.odometerKm <= 0).length;
  if (fillsNoOdo > 0) {
    qualityWarnings.push(`${fillsNoOdo} alimentări fără km odometru`);
  }
  const tripsNoKm = tripRows.filter((t) => t.distanceKm == null || t.distanceKm <= 0).length;
  if (tripsNoKm > 0) {
    qualityWarnings.push(`${tripsNoKm} curse fără km`);
  }
  if (kmReconciliationPct != null && Math.abs(kmReconciliationPct) > 5) {
    qualityWarnings.push(`Reconciliere km curse vs odometru: ${kmReconciliationPct > 0 ? '+' : ''}${kmReconciliationPct}%`);
  }

  const avgSegmentL100 =
    segments.length > 0
      ? round1(segments.reduce((s, seg) => s + seg.l100, 0) / segments.length)
      : null;

  const summary: ConsumptionSummary = {
    totalTripKm,
    totalFuelLiters: round1(totalFuelLiters),
    totalFuelCostCents,
    avgSegmentL100,
    segmentCount: segments.length,
    tripCount: tripRows.length,
    fillCount: fillsInPeriod.length,
    kmReconciliationPct,
    qualityWarnings,
  };

  const weekly = buildWeeklyBuckets(
    input.periodStart,
    input.periodEnd,
    input.trips,
    fillsInPeriod.map((f) => ({ incurredOn: new Date(f.incurredOn), fuelLiters: f.fuelLiters })),
    input.odometerReadings,
  );

  return {
    periodStart: input.periodStart.toISOString(),
    periodEnd: input.periodEnd.toISOString(),
    vehicleScope: input.vehicleScope,
    selectedVehicleCount: input.selectedVehicleCount,
    fuelTypeFilter: input.fuelTypeFilter,
    summary,
    summaryByFuelType: buildSummaryByFuelType({
      trips: tripRows,
      fills: fillsInPeriod,
      segments,
      vehicleFuelById: input.vehicleFuelById,
    }),
    weekly,
    fuelMix: buildFuelMix(fillsInPeriod),
    trips: tripRows,
    fills: fillsInPeriod,
    segments,
  };
}
