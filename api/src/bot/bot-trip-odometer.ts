import type { PrismaService } from '../prisma/prisma.service';

export type BotOdometerPoint = {
  recordedAt: Date;
  odometerKm: number;
};

export type BotTripOdometerPlan = {
  odoStart: number;
  odoEnd: number | null;
  eventAt: Date;
  /** Poate fi înregistrat fără încălcare timeline (inclusiv citiri viitoare). */
  feasible: boolean;
  capped: boolean;
};

export function tripOdometerEventAt(startedAt: Date, endedAt: Date | null): Date {
  return endedAt ?? startedAt;
}

/** Cel mai mic km dintre citirile strict după momentul T. */
export function minKmAfterTime(
  existing: BotOdometerPoint[],
  planned: BotOdometerPoint[],
  after: Date,
): number | null {
  let min: number | null = null;
  for (const p of [...existing, ...planned]) {
    if (p.recordedAt.getTime() > after.getTime()) {
      if (min === null || p.odometerKm < min) min = p.odometerKm;
    }
  }
  return min;
}

/** Km de încredere la momentul T (monoton pe timeline existent + planificat). */
export function trustedKmAtTime(
  existing: BotOdometerPoint[],
  planned: BotOdometerPoint[],
  at: Date,
  floorKm: number,
): number {
  const asc = [...existing, ...planned]
    .filter((p) => p.recordedAt.getTime() <= at.getTime())
    .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  let trusted = floorKm;
  for (const p of asc) {
    if (p.odometerKm >= trusted) trusted = p.odometerKm;
  }
  return trusted;
}

export function planBotTripOdometer(input: {
  existing: BotOdometerPoint[];
  planned: BotOdometerPoint[];
  startedAt: Date;
  endedAt: Date | null;
  distanceKm: number;
  floorKm: number;
}): BotTripOdometerPlan {
  const eventAt = tripOdometerEventAt(input.startedAt, input.endedAt);
  let odoStart = trustedKmAtTime(input.existing, input.planned, eventAt, input.floorKm);

  if (input.endedAt == null) {
    return { odoStart, odoEnd: null, eventAt, feasible: true, capped: false };
  }

  const ceiling = minKmAfterTime(input.existing, input.planned, eventAt);
  const distance = Math.max(1, input.distanceKm);
  let capped = false;

  if (ceiling != null) {
    const maxStart = ceiling - distance;
    if (maxStart < 0) {
      return { odoStart, odoEnd: null, eventAt, feasible: false, capped: false };
    }
    if (odoStart > maxStart) {
      odoStart = maxStart;
      capped = true;
    }
  }

  let odoEnd = odoStart + distance;
  if (ceiling != null && odoEnd > ceiling) {
    odoEnd = ceiling;
    capped = true;
  }

  const feasible = odoEnd > odoStart;
  return {
    odoStart,
    odoEnd: feasible ? odoEnd : null,
    eventAt,
    feasible,
    capped,
  };
}

export async function loadBotOdometerBaselines(
  prisma: PrismaService,
  tenantId: string,
  vehicleIds: string[],
): Promise<Map<string, BotOdometerPoint[]>> {
  const byVehicle = new Map<string, BotOdometerPoint[]>();
  if (vehicleIds.length === 0) return byVehicle;

  const [readings, trips] = await Promise.all([
    prisma.odometerReading.findMany({
      where: { vehicleId: { in: vehicleIds } },
      select: { vehicleId: true, odometerKm: true, recordedAt: true, sourceRef: true },
    }),
    prisma.trip.findMany({
      where: {
        tenantId,
        vehicleId: { in: vehicleIds },
        OR: [{ odometerEndKm: { not: null } }, { odometerStartKm: { not: null } }],
      },
      select: {
        id: true,
        vehicleId: true,
        startedAt: true,
        endedAt: true,
        odometerEndKm: true,
        odometerStartKm: true,
      },
    }),
  ]);

  const readingTripIds = new Set(
    readings
      .map((r) => r.sourceRef?.match(/^trip:(.+)$/)?.[1])
      .filter((id): id is string => Boolean(id)),
  );

  for (const id of vehicleIds) {
    byVehicle.set(id, []);
  }

  for (const r of readings) {
    byVehicle.get(r.vehicleId)!.push({ recordedAt: r.recordedAt, odometerKm: r.odometerKm });
  }

  for (const t of trips) {
    if (readingTripIds.has(t.id)) continue;
    const km = t.odometerEndKm ?? t.odometerStartKm;
    if (km == null) continue;
    byVehicle.get(t.vehicleId)!.push({
      recordedAt: tripOdometerEventAt(t.startedAt, t.endedAt),
      odometerKm: km,
    });
  }

  for (const points of byVehicle.values()) {
    points.sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  }

  return byVehicle;
}
