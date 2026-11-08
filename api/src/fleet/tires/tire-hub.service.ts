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
import type { TireOwnershipType, VehicleTireSeason } from '@prisma/client';
import type {
  TireHubAlert,
  TireHubAlertKind,
  TireHubAlertSeverity,
  TireHubAttentionSet,
  TireHubChangeoverItem,
  TireHubInventoryItem,
  TireHubInventoryLocation,
  TireHubInventorySet,
  TireHubPayload,
  TireHubRecentEvent,
} from './tire-hub.types';
import {
  syncSeasonTireRemindersForTenant,
  type SeasonReminderSyncResult,
} from './tire-season-reminders';
import {
  applyRecommendedReplaceFlags,
  tireHubAccessScopeSignature,
} from './tire-recommended-replace';
import { pickSetSeason } from './tire-domain.types';

const ALERT_LIMIT = 200;
const ATTENTION_LIMIT = 50;
const SEASON_REMINDER_THROTTLE_MS = 24 * 60 * 60 * 1000;

const lastSeasonReminderSyncByScope = new Map<string, number>();

const SEVERITY_RANK: Record<TireHubAlertSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

/** Managers land on /edit so set fiche mutations are enabled (view is read-only). */
function vehicleWheelsHref(vehicleId: string, setId?: string): string {
  const base = `/fleet/vehicles/${vehicleId}/edit?tab=wheels`;
  return setId ? `${base}&setId=${encodeURIComponent(setId)}` : base;
}

function createSeasonTicketHref(vehicleId: string, plate: string): string {
  const subject = `Schimb sezon anvelope ${plate}`;
  return `/fleet/tickets/new?vehicleId=${encodeURIComponent(vehicleId)}&subject=${encodeURIComponent(subject)}`;
}

function intakePhotoCount(raw: unknown): number {
  return Array.isArray(raw) ? raw.length : 0;
}

function oppositeSeason(season: VehicleTireSeason): VehicleTireSeason | null {
  if (season === 'summer') return 'winter';
  if (season === 'winter') return 'summer';
  return null;
}

function rollupOwnership(
  types: TireOwnershipType[],
): TireOwnershipType | 'mixed' | null {
  if (types.length === 0) return null;
  const uniq = new Set(types);
  if (uniq.size === 1) return types[0]!;
  return 'mixed';
}

function dominantString(values: Array<string | null | undefined>): string | null {
  const cleaned = values.map((v) => v?.trim()).filter((v): v is string => !!v);
  if (cleaned.length === 0) return null;
  const uniq = new Set(cleaned);
  return uniq.size === 1 ? cleaned[0]! : null;
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
      select: {
        id: true,
        registrationNumber: true,
        clientId: true,
        client: { select: { code: true, legalName: true } },
      },
    });
    const vehicleIds = vehicles.map((v) => v.id);
    const plateById = new Map(vehicles.map((v) => [v.id, v.registrationNumber]));
    const vehicleMeta = new Map(
      vehicles.map((v) => [
        v.id,
        {
          clientId: v.clientId,
          clientCode: v.client.code,
          clientName: v.client.legalName,
        },
      ]),
    );

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
        storageStays: {
          where: { checkOutAt: null },
          take: 1,
          include: { supplier: { select: { id: true, legalName: true } } },
        },
        items: {
          orderBy: { sortOrder: 'asc' },
          include: {
            asset: {
              select: {
                id: true,
                dot: true,
                treadMm: true,
                season: true,
                recommendedReplace: true,
                ownershipType: true,
                brand: true,
                model: true,
                size: true,
                serialOrQr: true,
                runFlat: true,
                tpmsSensorPresent: true,
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
            include: { supplier: { select: { id: true, legalName: true } } },
            orderBy: { validFrom: 'desc' },
          });
    const hotelSetIds = new Set<string>();
    const hotelPlacementBySet = new Map<string, (typeof hotelPlacements)[number]>();
    for (const s of sets) {
      if (s.storageStays.length > 0) hotelSetIds.add(s.id);
    }
    for (const pl of hotelPlacements) {
      if (pl.setId) {
        hotelSetIds.add(pl.setId);
        if (!hotelPlacementBySet.has(pl.setId)) hotelPlacementBySet.set(pl.setId, pl);
      }
    }

    /** Sezoane disponibile pe vehicul (pentru set opus). */
    const seasonsByVehicle = new Map<string, Set<VehicleTireSeason>>();
    for (const set of sets) {
      const bag = seasonsByVehicle.get(set.vehicleId) ?? new Set<VehicleTireSeason>();
      bag.add(set.season);
      seasonsByVehicle.set(set.vehicleId, bag);
    }

    let setsMounted = 0;
    let setsAtHotel = 0;
    let setsAtClient = 0;

    const isSetMounted = (set: (typeof sets)[number]): boolean =>
      set.placements.some((p) => p.kind === 'on_vehicle' && p.vehicleId === set.vehicleId);

    for (const set of sets) {
      const mounted = isSetMounted(set);
      const atHotel = hotelSetIds.has(set.id);
      const atClient = set.placements.some((p) => p.kind === 'at_client');
      if (mounted) setsMounted += 1;
      else if (atHotel) setsAtHotel += 1;
      else if (atClient) setsAtClient += 1;
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
      const href = vehicleWheelsHref(set.vehicleId, set.id);
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

    const inventorySets: TireHubInventorySet[] = [];
    for (const set of sets) {
      const mounted = isSetMounted(set);
      const atHotel = hotelSetIds.has(set.id);
      const stay = set.storageStays[0];
      const hotelPl = hotelPlacementBySet.get(set.id);
      const meta = vehicleMeta.get(set.vehicleId);
      const plate = plateById.get(set.vehicleId) ?? '—';

      let location: TireHubInventoryLocation;
      if (mounted) location = 'on_vehicle';
      else if (atHotel) location = 'at_supplier_hotel';
      else if (set.placements.some((p) => p.kind === 'at_client')) location = 'at_client';
      else location = 'other';

      const treadValues = set.items
        .map((i) => i.asset.treadMm)
        .filter((v): v is number => v != null && Number.isFinite(v));
      const minTreadMm = treadValues.length ? Math.min(...treadValues) : null;
      const agedDots = set.items
        .filter((i) => isDotAged(i.asset.dot, now))
        .map((i) => i.asset.dot?.trim())
        .filter((d): d is string => !!d);
      const worstDot = agedDots[0] ?? set.items.map((i) => i.asset.dot?.trim()).find((d) => !!d) ?? null;

      const opp = oppositeSeason(set.season);
      const vehicleSeasons = seasonsByVehicle.get(set.vehicleId) ?? new Set();
      const hasOppositeSeasonStored = opp != null && vehicleSeasons.has(opp);

      const setAssetIds = assetIdsBySetId.get(set.id) ?? new Set<string>();
      const kinds = new Set<TireHubAlertKind>(
        trimmedAlerts
          .filter((a) => {
            if (a.setId === set.id) return true;
            if (a.assetId != null && setAssetIds.has(a.assetId)) return true;
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

      const placementByAsset = new Map(
        set.placements
          .filter((p) => p.assetId)
          .map((p) => [p.assetId, p] as const),
      );

      const items: TireHubInventoryItem[] = set.items.map((i) => {
        const pl = placementByAsset.get(i.asset.id);
        return {
          assetId: i.asset.id,
          position: pl?.position ?? null,
          brand: i.asset.brand,
          model: i.asset.model,
          size: i.asset.size,
          dot: i.asset.dot,
          treadMm: i.asset.treadMm,
          serialOrQr: i.asset.serialOrQr,
          recommendedReplace: i.asset.recommendedReplace,
          ownershipType: i.asset.ownershipType,
          runFlat: i.asset.runFlat,
          tpmsSensorPresent: i.asset.tpmsSensorPresent,
        };
      });

      inventorySets.push({
        setId: set.id,
        vehicleId: set.vehicleId,
        plate,
        clientId: meta?.clientId ?? set.clientId,
        clientCode: meta?.clientCode ?? '—',
        clientName: meta?.clientName ?? '—',
        setName: set.name,
        season: set.season,
        mountedAs: set.mountedAs,
        itemCount: set.items.length,
        location,
        isMounted: mounted,
        atHotel,
        stayId: stay?.id ?? null,
        supplierId: stay?.supplierId ?? hotelPl?.supplierId ?? null,
        supplierName: stay?.supplier.legalName ?? hotelPl?.supplier?.legalName ?? null,
        locationCode: stay?.locationCode ?? hotelPl?.locationCode ?? null,
        checkInAt: stay?.checkInAt.toISOString() ?? hotelPl?.validFrom.toISOString() ?? null,
        feeCents: stay?.feeCents ?? null,
        contractRef: stay?.contractRef ?? null,
        intakeTreadNotes: stay?.intakeTreadNotes ?? null,
        photoCount: intakePhotoCount(stay?.intakePhotos),
        minTreadMm,
        worstDot,
        dominantBrand: dominantString(set.items.map((i) => i.asset.brand)),
        dominantSize: dominantString(set.items.map((i) => i.asset.size)),
        itemsSeason: (() => {
          const s = pickSetSeason(set.items.map((i) => i.asset.season));
          return s === 'unknown' ? null : s;
        })(),
        seasonLabelMismatch: (() => {
          const itemsSeason = pickSetSeason(set.items.map((i) => i.asset.season));
          return (
            itemsSeason !== 'unknown' &&
            set.season !== 'unknown' &&
            itemsSeason !== set.season
          );
        })(),
        assetsRecommendedReplace: set.items.filter((i) => i.asset.recommendedReplace).length,
        hasOppositeSeasonStored,
        ownershipType: rollupOwnership(set.items.map((i) => i.asset.ownershipType)),
        alertKinds: [...kinds],
        hrefWheels: vehicleWheelsHref(set.vehicleId, set.id),
        hrefCreateTicket: createSeasonTicketHref(set.vehicleId, plate),
        costCentsTotal: 0,
        costCount: 0,
        lastMountKm: null,
        lastDemountKm: null,
        recentEvents: [],
        items,
      });
    }

    const setIds = inventorySets.map((s) => s.setId);
    if (setIds.length > 0) {
      const [costGroups, recentRaw, lastMountRows, lastDemountRows] = await Promise.all([
        this.prisma.costEntry.groupBy({
          by: ['tireSetId'],
          where: { tenantId: tenant.id, tireSetId: { in: setIds } },
          _sum: { amountCents: true },
          _count: { _all: true },
        }),
        this.prisma.tireEvent.findMany({
          where: { tenantId: tenant.id, setId: { in: setIds } },
          orderBy: { createdAt: 'desc' },
          take: Math.min(800, setIds.length * 8),
          select: {
            id: true,
            setId: true,
            type: true,
            createdAt: true,
            odometerKm: true,
            workOrderId: true,
          },
        }),
        this.prisma.tireEvent.findMany({
          where: {
            tenantId: tenant.id,
            setId: { in: setIds },
            type: 'mount',
            odometerKm: { not: null },
          },
          orderBy: { createdAt: 'desc' },
          distinct: ['setId'],
          select: { setId: true, odometerKm: true },
        }),
        this.prisma.tireEvent.findMany({
          where: {
            tenantId: tenant.id,
            setId: { in: setIds },
            type: 'demount',
            odometerKm: { not: null },
          },
          orderBy: { createdAt: 'desc' },
          distinct: ['setId'],
          select: { setId: true, odometerKm: true },
        }),
      ]);

      const costBySet = new Map(
        costGroups
          .filter((g) => g.tireSetId)
          .map((g) => [
            g.tireSetId!,
            { total: g._sum.amountCents ?? 0, count: g._count._all },
          ]),
      );

      const eventsBySet = new Map<string, TireHubRecentEvent[]>();
      for (const ev of recentRaw) {
        if (!ev.setId) continue;
        const list = eventsBySet.get(ev.setId) ?? [];
        if (list.length >= 5) continue;
        list.push({
          id: ev.id,
          type: ev.type,
          createdAt: ev.createdAt.toISOString(),
          odometerKm: ev.odometerKm,
          workOrderId: ev.workOrderId,
        });
        eventsBySet.set(ev.setId, list);
      }

      const mountKmBySet = new Map(
        lastMountRows.filter((r) => r.setId).map((r) => [r.setId!, r.odometerKm]),
      );
      const demountKmBySet = new Map(
        lastDemountRows.filter((r) => r.setId).map((r) => [r.setId!, r.odometerKm]),
      );

      for (const row of inventorySets) {
        const cost = costBySet.get(row.setId);
        if (cost) {
          row.costCentsTotal = cost.total;
          row.costCount = cost.count;
        }
        row.recentEvents = eventsBySet.get(row.setId) ?? [];
        row.lastMountKm = mountKmBySet.get(row.setId) ?? null;
        row.lastDemountKm = demountKmBySet.get(row.setId) ?? null;
      }
    }

    inventorySets.sort((a, b) => {
      if (a.isMounted !== b.isMounted) return a.isMounted ? -1 : 1;
      return a.plate.localeCompare(b.plate, 'ro') || a.season.localeCompare(b.season);
    });

    const recommendedSeason: 'summer' | 'winter' = isWinterDrivingSeason(now)
      ? 'winter'
      : 'summer';
    /** Direct din set montat + isSeasonMismatch — nu din alerts truncate. */
    const mismatchMounted = inventorySets.filter(
      (s) => s.isMounted && isSeasonMismatch(s.season, true, now),
    );
    const mismatchVehicleIds = [...new Set(mismatchMounted.map((s) => s.vehicleId))];

    const openWoByVehicle = new Map<string, { id: string; status: string }>();
    if (mismatchVehicleIds.length > 0) {
      const openWos = await this.prisma.maintenanceWorkOrder.findMany({
        where: {
          tenantId: tenant.id,
          vehicleId: { in: mismatchVehicleIds },
          serviceOrderType: 'R',
          status: { notIn: ['done', 'cancelled'] },
        },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, vehicleId: true, status: true, tyreWorkIntent: true },
      });
      const seasonalFirst = [
        ...openWos.filter((w) => w.tyreWorkIntent === 'seasonal_changeover'),
        ...openWos.filter((w) => w.tyreWorkIntent !== 'seasonal_changeover'),
      ];
      for (const wo of seasonalFirst) {
        if (!openWoByVehicle.has(wo.vehicleId)) {
          openWoByVehicle.set(wo.vehicleId, { id: wo.id, status: wo.status });
        }
      }
    }

    const changeoverQueue: TireHubChangeoverItem[] = [];
    const seenChangeover = new Set<string>();
    for (const row of mismatchMounted) {
      if (seenChangeover.has(row.vehicleId)) continue;
      seenChangeover.add(row.vehicleId);
      const wo = openWoByVehicle.get(row.vehicleId);
      const meta = vehicleMeta.get(row.vehicleId);
      changeoverQueue.push({
        vehicleId: row.vehicleId,
        plate: row.plate,
        clientCode: meta?.clientCode ?? row.clientCode,
        mountedSetId: row.setId,
        mountedSeason: row.season,
        hasOppositeSeasonStored: row.hasOppositeSeasonStored,
        recommendedSeason,
        openWorkOrderId: wo?.id ?? null,
        openWorkOrderStatus: wo?.status ?? null,
        hrefWheels: row.hrefWheels,
        hrefCreateTicket: row.hrefCreateTicket,
        hrefWorkOrder: wo ? `/fleet/work-orders/${wo.id}` : null,
      });
    }
    changeoverQueue.sort((a, b) => a.plate.localeCompare(b.plate, 'ro'));

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
      inventorySets,
      changeoverQueue,
      ...(seasonRemindersSynced ? { seasonRemindersSynced } : {}),
    };
  }

  /** CSV inventar — o linie per anvelopă (sau set fără items). */
  async exportInventoryCsv(tenantSlug: string, access?: AccessContext): Promise<string> {
    const hub = await this.getHub(tenantSlug, access);
    const header = [
      'plate',
      'clientCode',
      'clientName',
      'setId',
      'setName',
      'season',
      'location',
      'supplierName',
      'locationCode',
      'minTreadMm',
      'worstDot',
      'lastMountKm',
      'lastDemountKm',
      'costCentsTotal',
      'hasOppositeSeason',
      'assetId',
      'position',
      'brand',
      'model',
      'size',
      'dot',
      'treadMm',
      'serialOrQr',
      'recommendedReplace',
    ].join(',');

    const lines: string[] = [header];
    for (const set of hub.inventorySets) {
      const items = set.items?.length ? set.items : [null];
      for (const it of items) {
        lines.push(
          [
            set.plate,
            set.clientCode,
            set.clientName,
            set.setId,
            set.setName ?? '',
            set.season,
            set.location,
            set.supplierName ?? '',
            set.locationCode ?? '',
            set.minTreadMm != null ? String(set.minTreadMm) : '',
            set.worstDot ?? '',
            set.lastMountKm != null ? String(set.lastMountKm) : '',
            set.lastDemountKm != null ? String(set.lastDemountKm) : '',
            String(set.costCentsTotal ?? 0),
            set.hasOppositeSeasonStored ? 'yes' : 'no',
            it?.assetId ?? '',
            it?.position ?? '',
            it?.brand ?? '',
            it?.model ?? '',
            it?.size ?? '',
            it?.dot ?? '',
            it?.treadMm != null ? String(it.treadMm) : '',
            it?.serialOrQr ?? '',
            it?.recommendedReplace ? 'yes' : it ? 'no' : '',
          ]
            .map(escapeHubCsvCell)
            .join(','),
        );
      }
    }
    return `\uFEFF${lines.join('\n')}\n`;
  }
}

function escapeHubCsvCell(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
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
    inventorySets: [],
    changeoverQueue: [],
  };
}
