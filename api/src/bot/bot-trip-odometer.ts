import type { PrismaService } from '../prisma/prisma.service';

export type BotOdometerPoint = {
  recordedAt: Date;
  odometerKm: number;
};

export function tripOdometerEventAt(startedAt: Date, endedAt: Date | null): Date {
  return endedAt ?? startedAt;
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
}): { odoStart: number; odoEnd: number | null; eventAt: Date } {
  const eventAt = tripOdometerEventAt(input.startedAt, input.endedAt);
  const odoStart = trustedKmAtTime(input.existing, input.planned, eventAt, input.floorKm);
  const odoEnd = input.endedAt != null ? odoStart + input.distanceKm : null;
  return { odoStart, odoEnd, eventAt };
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
