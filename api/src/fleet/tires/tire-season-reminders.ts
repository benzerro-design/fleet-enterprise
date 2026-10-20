import { Prisma, ReminderSourceType, type VehicleTireSeason } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_REMINDER_OFFSETS } from '../../ops/document-reminders';
import { isSeasonMismatch, isWinterDrivingSeason } from './tire-thresholds';

export const SEASON_TIRE_REMINDER_TAG = 'fleet007:season_tire_swap';

export type SeasonReminderSyncResult = {
  created: number;
  updated: number;
  deactivated: number;
};

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Start of the next driving-season window (Apr 1 or Nov 1 UTC). */
export function nextSeasonWindowStart(now = new Date()): Date {
  const y = now.getUTCFullYear();
  const winter = isWinterDrivingSeason(now);
  if (winter) {
    return new Date(Date.UTC(y + (now.getUTCMonth() <= 2 ? 0 : 1), 3, 1));
  }
  const nov = new Date(Date.UTC(y, 10, 1));
  if (now.getTime() < nov.getTime()) return nov;
  return new Date(Date.UTC(y + 1, 10, 1));
}

function seasonReminderDueOn(mountedMismatch: boolean, now: Date): Date {
  return mountedMismatch ? startOfUtcDay(now) : nextSeasonWindowStart(now);
}

function nextApr1Utc(now: Date): Date {
  const y = now.getUTCFullYear();
  const apr = new Date(Date.UTC(y, 3, 1));
  if (now.getTime() < apr.getTime()) return apr;
  return new Date(Date.UTC(y + 1, 3, 1));
}

function nextNov1Utc(now: Date): Date {
  const y = now.getUTCFullYear();
  const nov = new Date(Date.UTC(y, 10, 1));
  if (now.getTime() < nov.getTime()) return nov;
  return new Date(Date.UTC(y + 1, 10, 1));
}

export function isWithin14DaysBeforeWindow(windowStart: Date, now: Date): boolean {
  const dayMs = 86_400_000;
  const days =
    (startOfUtcDay(windowStart).getTime() - startOfUtcDay(now).getTime()) / dayMs;
  return days >= 0 && days <= 14;
}

function wheelsHref(vehicleId: string): string {
  return `/fleet/vehicles/${vehicleId}?tab=wheels`;
}

function isSetMounted(
  set: {
    vehicleId: string;
    placements: Array<{ kind: string; vehicleId: string | null; validTo: Date | null }>;
  },
): boolean {
  return set.placements.some(
    (p) => p.kind === 'on_vehicle' && p.validTo == null && p.vehicleId === set.vehicleId,
  );
}

function oppositeSeason(season: VehicleTireSeason): VehicleTireSeason | null {
  if (season === 'summer') return 'winter';
  if (season === 'winter') return 'summer';
  return null;
}

function vehicleNeedsSeasonReminder(
  sets: Array<{
    id: string;
    vehicleId: string;
    season: VehicleTireSeason;
    placements: Array<{ kind: string; vehicleId: string | null; validTo: Date | null }>;
  }>,
  now: Date,
): { dueOn: Date; titlePlate: string; vehicleId: string } | null {
  if (sets.length === 0) return null;

  const mountedSets = sets.filter((s) => isSetMounted(s));
  const storedSets = sets.filter((s) => !isSetMounted(s));

  for (const mounted of mountedSets) {
    const need = oppositeSeason(mounted.season);
    if (!need) continue;
    const hasStoredOpposite = storedSets.some((s) => s.season === need);
    if (!hasStoredOpposite) continue;

    if (isSeasonMismatch(mounted.season, true, now)) {
      return {
        vehicleId: mounted.vehicleId,
        titlePlate: '',
        dueOn: seasonReminderDueOn(true, now),
      };
    }

    const windowStart =
      mounted.season === 'summer'
        ? nextNov1Utc(now)
        : mounted.season === 'winter'
          ? nextApr1Utc(now)
          : null;
    if (windowStart && isWithin14DaysBeforeWindow(windowStart, now)) {
      return {
        vehicleId: mounted.vehicleId,
        titlePlate: '',
        dueOn: startOfUtcDay(windowStart),
      };
    }
  }
  return null;
}

export async function syncSeasonTireRemindersForTenant(
  prisma: PrismaService,
  tenantId: string,
  vehicleIds?: string[],
): Promise<SeasonReminderSyncResult> {
  const now = new Date();
  const result: SeasonReminderSyncResult = { created: 0, updated: 0, deactivated: 0 };

  if (vehicleIds != null && vehicleIds.length === 0) {
    return result;
  }

  const vehicles = await prisma.vehicle.findMany({
    where: {
      tenantId,
      ...(vehicleIds != null ? { id: { in: vehicleIds } } : {}),
    },
    select: { id: true, registrationNumber: true },
  });

  const ids = vehicles.map((v) => v.id);
  if (ids.length === 0) return result;

  const sets = await prisma.tireSet.findMany({
    where: { tenantId, vehicleId: { in: ids }, archivedAt: null },
    include: {
      placements: { where: { validTo: null } },
    },
  });

  const setsByVehicle = new Map<string, typeof sets>();
  for (const s of sets) {
    const list = setsByVehicle.get(s.vehicleId) ?? [];
    list.push(s);
    setsByVehicle.set(s.vehicleId, list);
  }

  const plateById = new Map(vehicles.map((v) => [v.id, v.registrationNumber]));

  const existing = await prisma.reminderAction.findMany({
    where: {
      tenantId,
      sourceType: ReminderSourceType.custom,
      notes: { contains: SEASON_TIRE_REMINDER_TAG },
      vehicleId: { in: ids },
    },
    select: { id: true, vehicleId: true, isActive: true },
  });
  const existingByVehicle = new Map(existing.map((r) => [r.vehicleId, r]));

  const dayOffsets = DEFAULT_REMINDER_OFFSETS;

  for (const vehicle of vehicles) {
    const vehicleSets = setsByVehicle.get(vehicle.id) ?? [];
    const need = vehicleNeedsSeasonReminder(vehicleSets, now);
    const row = existingByVehicle.get(vehicle.id);
    const plate = plateById.get(vehicle.id) ?? 'vehicul';
    const title = `Schimb anvelope sezonier — ${plate}`;
    const notes = `${SEASON_TIRE_REMINDER_TAG}\n${wheelsHref(vehicle.id)}`;

    if (!need) {
      if (row?.isActive) {
        await prisma.reminderAction.update({
          where: { id: row.id },
          data: { isActive: false },
        });
        result.deactivated += 1;
      }
      continue;
    }

    const dueOn = need.dueOn;
    if (row) {
      await prisma.reminderAction.update({
        where: { id: row.id },
        data: {
          title,
          notes,
          dueOn,
          reminderOffsetsDays: dayOffsets,
          isActive: true,
        },
      });
      result.updated += 1;
    } else {
      await prisma.reminderAction.create({
        data: {
          tenantId,
          vehicleId: vehicle.id,
          sourceType: ReminderSourceType.custom,
          title,
          notes,
          dueOn,
          reminderOffsetsDays: dayOffsets ?? Prisma.DbNull,
          isActive: true,
        },
      });
      result.created += 1;
    }
  }

  return result;
}
