import { Injectable } from '@nestjs/common';
import type { AccessContext } from '../../iam/access-context.types';
import { vehicleClientScope } from '../../iam/client-access';
import { PrismaService } from '../../prisma/prisma.service';
import {
  isDotAged,
  isSeasonMismatch,
  isTreadLow,
  isWinterDrivingSeason,
  treadLowThresholdMm,
  TIRE_DOT_MAX_AGE_YEARS,
} from './tire-thresholds';
import type {
  TireHubAlert,
  TireHubAlertKind,
  TireHubAlertSeverity,
  TireHubAttentionSet,
  TireHubPayload,
} from './tire-hub.types';
import {
  syncSeasonTireRemindersForTenant,
  type SeasonReminderSyncResult,
} from './tire-season-reminders';
import {
  applyRecommendedReplaceFlags,
  tireHubAccessScopeSignature,
} from './tire-recommended-replace';

const ALERT_LIMIT = 200;
const ATTENTION_LIMIT = 50;
const SEASON_REMINDER_THROTTLE_MS = 24 * 60 * 60 * 1000;

const lastSeasonReminderSyncByScope = new Map<string, number>();

const SEVERITY_RANK: Record<TireHubAlertSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

function vehicleWheelsHref(vehicleId: string): string {
  return `/fleet/vehicles/${vehicleId}?tab=wheels`;
}

function alertSeverity(kind: TireHubAlertKind, treadMm?: number | null): TireHubAlertSeverity {
  if (kind === 'tread_low' && treadMm != null && treadMm < 2) return 'critical';
  if (kind === 'tread_low' || kind === 'dot_aged' || kind === 'recommended_replace') return 'warning';
  return 'info';
}

function alertKey(a: TireHubAlert): string {
  return `${a.kind}|${a.vehicleId}|${a.setId ?? ''}|${a.assetId ?? ''}|${a.message}`;
}

@Injectable()
export class TireHubService {
  constructor(private readonly prisma: PrismaService) {}

  async syncSeasonReminders(
    tenantSlug: string,
    access?: AccessContext,
  ): Promise<SeasonReminderSyncResult> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) return { created: 0, updated: 0, deactivated: 0 };

    const clientVehicleScope = access ? vehicleClientScope(access) : {};
    const vehicles = await this.prisma.vehicle.findMany({
      where: { tenantId: tenant.id, ...clientVehicleScope },
      select: { id: true },
    });
    const vehicleIds = vehicles.map((v) => v.id);
    return syncSeasonTireRemindersForTenant(this.prisma, tenant.id, vehicleIds);
  }

  private maybeSyncSeasonRemindersThrottled(
    tenantId: string,
    tenantSlug: string,
    vehicleIds: string[],
    access?: AccessContext,
  ): Promise<SeasonReminderSyncResult | null> {
    const scopeSig = tireHubAccessScopeSignature(vehicleIds);
    const throttleKey = `${tenantId}:${scopeSig}`;
    const now = Date.now();
    const last = lastSeasonReminderSyncByScope.get(throttleKey) ?? 0;
    if (now - last < SEASON_REMINDER_THROTTLE_MS) return Promise.resolve(null);
    lastSeasonReminderSyncByScope.set(throttleKey, now);
    return this.syncSeasonReminders(tenantSlug, access).catch((err) => {
      console.error('syncSeasonReminders throttled hub sync failed', err);
      return null;
    });
  }

  async getHub(tenantSlug: string, access?: AccessContext): Promise<TireHubPayload> {
    const now = new Date();
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return emptyHub(now);
    }

    const clientVehicleScope = access ? vehicleClientScope(access) : {};
    const vehicles = await this.prisma.vehicle.findMany({
      where: { tenantId: tenant.id, ...clientVehicleScope },
      select: { id: true, registrationNumber: true },
    });
    const vehicleIds = vehicles.map((v) => v.id);
    const plateById = new Map(vehicles.map((v) => [v.id, v.registrationNumber]));

    if (vehicleIds.length === 0) {
      return emptyHub(now);
    }

    const seasonRemindersSynced = await this.maybeSyncSeasonRemindersThrottled(
      tenant.id,
      tenantSlug,
      vehicleIds,
      access,
    );

    await applyRecommendedReplaceFlags(this.prisma, tenant.id, vehicleIds, now);

    const sets = await this.prisma.tireSet.findMany({
      where: { tenantId: tenant.id, vehicleId: { in: vehicleIds }, archivedAt: null },
      include: {
        placements: { where: { validTo: null } },
        storageStays: { where: { checkOutAt: null }, take: 1 },
        items: {
          include: {
            asset: {
              select: {
                id: true,
                dot: true,
                treadMm: true,
                season: true,
                recommendedReplace: true,
              },
            },
          },
        },
      },
    });

    const hotelPlacements =
      sets.length === 0
        ? []
        : await this.prisma.tirePlacement.findMany({
            where: {
              setId: { in: sets.map((s) => s.id) },
              kind: 'at_supplier_hotel',
              validTo: null,
            },
            select: { setId: true },
          });
    const hotelSetIds = new Set<string>();
    for (const s of sets) {
      if (s.storageStays.length > 0) hotelSetIds.add(s.id);
    }
    for (const pl of hotelPlacements) {
      if (pl.setId) hotelSetIds.add(pl.setId);
    }

    let setsMounted = 0;
    let setsAtHotel = 0;
    let setsAtClient = 0;

    const isSetMounted = (set: (typeof sets)[number]): boolean =>
      set.placements.some((p) => p.kind === 'on_vehicle' && p.vehicleId === set.vehicleId);

    for (const set of sets) {
      const mounted = isSetMounted(set);
      const atHotel = hotelSetIds.has(set.id);
      if (mounted) setsMounted += 1;
      else if (atHotel) setsAtHotel += 1;
      else setsAtClient += 1;
    }

    const fitments = await this.prisma.vehicleWheelFitment.findMany({
      where: { vehicleId: { in: vehicleIds } },
      select: {
        vehicleId: true,
        position: true,
        season: true,
        dot: true,
        treadMm: true,
      },
    });

    const alerts: TireHubAlert[] = [];
    const seen = new Set<string>();
    const treadLowAssetIds = new Set<string>();
    const dotAgedAssetIds = new Set<string>();
    const replaceAssetIds = new Set<string>();

    const pushAlert = (
      row: Omit<TireHubAlert, 'severity'> & { treadMm?: number | null },
    ): void => {
      const full: TireHubAlert = {
        ...row,
        severity: alertSeverity(row.kind, row.treadMm),
      };
      const key = alertKey(full);
      if (seen.has(key)) return;
      seen.add(key);
      alerts.push(full);
    };

    for (const f of fitments) {
      const plate = plateById.get(f.vehicleId) ?? '—';
      const href = vehicleWheelsHref(f.vehicleId);
      const pos = f.position.toUpperCase();

      if (isTreadLow(f.treadMm, f.season)) {
        const thr = treadLowThresholdMm(f.season);
        pushAlert({
          kind: 'tread_low',
          vehicleId: f.vehicleId,
          plate,
          treadMm: f.treadMm,
          message: `${plate} ${pos}: uzură ${f.treadMm?.toFixed(1) ?? '?'} mm (prag ${thr} mm)`,
          href,
        });
      }
      if (isDotAged(f.dot, now)) {
        pushAlert({
          kind: 'dot_aged',
          vehicleId: f.vehicleId,
          plate,
          message: `${plate} ${pos}: DOT ${f.dot?.trim() ?? '—'} — vechime ≥ ${TIRE_DOT_MAX_AGE_YEARS} ani`,
          href,
        });
      }
    }

    for (const set of sets) {
      const plate = plateById.get(set.vehicleId) ?? '—';
      const href = vehicleWheelsHref(set.vehicleId);
      const mounted = isSetMounted(set);

      if (isSeasonMismatch(set.season, mounted, now)) {
        const seasonLabel = isWinterDrivingSeason(now) ? 'iarnă' : 'vară';
        pushAlert({
          kind: 'season_mismatch',
          vehicleId: set.vehicleId,
          plate,
          setId: set.id,
          message: `${plate}: set ${set.season} montat — recomandat sezon ${seasonLabel}`,
          href,
        });
      }

      for (const item of set.items) {
        const a = item.asset;
        if (a.recommendedReplace) {
          replaceAssetIds.add(a.id);
          pushAlert({
            kind: 'recommended_replace',
            vehicleId: set.vehicleId,
            plate,
            setId: set.id,
            assetId: a.id,
            message: `${plate}: anvelopă marcată pentru înlocuire`,
            href,
          });
        }
        if (isTreadLow(a.treadMm, a.season)) {
          treadLowAssetIds.add(a.id);
          const thr = treadLowThresholdMm(a.season);
          pushAlert({
            kind: 'tread_low',
            vehicleId: set.vehicleId,
            plate,
            setId: set.id,
            assetId: a.id,
            treadMm: a.treadMm,
            message: `${plate}: uzură ${a.treadMm?.toFixed(1) ?? '?'} mm (prag ${thr} mm)`,
            href,
          });
        }
        if (isDotAged(a.dot, now)) {
          dotAgedAssetIds.add(a.id);
          pushAlert({
            kind: 'dot_aged',
            vehicleId: set.vehicleId,
            plate,
            setId: set.id,
            assetId: a.id,
            message: `${plate}: DOT ${a.dot?.trim() ?? '—'} — vechime ≥ ${TIRE_DOT_MAX_AGE_YEARS} ani`,
            href,
          });
        }
      }
    }

    alerts.sort((a, b) => {
      const sd = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (sd !== 0) return sd;
      return a.plate.localeCompare(b.plate, 'ro');
    });

    const trimmedAlerts = alerts.slice(0, ALERT_LIMIT);

    const assetIdsBySetId = new Map<string, Set<string>>();
    for (const set of sets) {
      assetIdsBySetId.set(set.id, new Set(set.items.map((i) => i.asset.id)));
    }

    const attentionSets: TireHubAttentionSet[] = [];
    for (const set of sets) {
      const mounted = isSetMounted(set);
      const setAssetIds = assetIdsBySetId.get(set.id) ?? new Set<string>();
      const kinds = new Set<TireHubAlertKind>(
        trimmedAlerts
          .filter((a) => {
            if (a.setId === set.id) return true;
            if (a.assetId != null && setAssetIds.has(a.assetId)) return true;
            // Wheel fitment alerts (no set/asset): only the mounted set on that vehicle.
            if (
              a.vehicleId === set.vehicleId &&
              a.setId == null &&
              a.assetId == null &&
              mounted
            ) {
              return true;
            }
            return false;
          })
          .map((a) => a.kind),
      );
      if (kinds.size === 0) continue;

      attentionSets.push({
        vehicleId: set.vehicleId,
        plate: plateById.get(set.vehicleId) ?? '—',
        setId: set.id,
        setName: set.name,
        season: set.season,
        isMounted: isSetMounted(set),
        atHotel: hotelSetIds.has(set.id),
        alertKinds: [...kinds],
      });
    }

    attentionSets.sort(
      (a, b) => b.alertKinds.length - a.alertKinds.length || a.plate.localeCompare(b.plate, 'ro'),
    );

    const fitmentTreadLowPositions = new Set<string>();
    const fitmentDotAgedPositions = new Set<string>();
    for (const f of fitments) {
      const key = `${f.vehicleId}:${f.position}`;
      if (isTreadLow(f.treadMm, f.season)) fitmentTreadLowPositions.add(key);
      if (isDotAged(f.dot, now)) fitmentDotAgedPositions.add(key);
    }

    return {
      generatedAt: now.toISOString(),
      summary: {
        setsMounted,
        setsAtHotel,
        setsAtClient,
        assetsRecommendedReplace: replaceAssetIds.size,
        assetsDotAged: dotAgedAssetIds.size + fitmentDotAgedPositions.size,
        assetsTreadLow: treadLowAssetIds.size + fitmentTreadLowPositions.size,
      },
      alerts: trimmedAlerts,
      attentionSets: attentionSets.slice(0, ATTENTION_LIMIT),
      ...(seasonRemindersSynced ? { seasonRemindersSynced } : {}),
    };
  }
}

function emptyHub(now: Date): TireHubPayload {
  return {
    generatedAt: now.toISOString(),
    summary: {
      setsMounted: 0,
      setsAtHotel: 0,
      setsAtClient: 0,
      assetsRecommendedReplace: 0,
      assetsDotAged: 0,
      assetsTreadLow: 0,
    },
    alerts: [],
    attentionSets: [],
  };
}
