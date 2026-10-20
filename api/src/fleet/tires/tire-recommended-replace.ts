import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { isDotAged, isTreadLow } from './tire-thresholds';

type DbClient = PrismaService | Prisma.TransactionClient;

export function tireHubAccessScopeSignature(vehicleIds: string[]): string {
  if (vehicleIds.length === 0) return 'empty';
  const sorted = [...vehicleIds].sort();
  return createHash('sha256').update(sorted.join('\0')).digest('hex').slice(0, 32);
}

function readAttrsRecord(attrs: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  if (attrs != null && typeof attrs === 'object' && !Array.isArray(attrs)) {
    return attrs as Record<string, unknown>;
  }
  return {};
}

export function isAutoRecommendedReplace(attrs: Prisma.JsonValue | null | undefined): boolean {
  const a = readAttrsRecord(attrs);
  return a.autoRecommendedReplace === true;
}

function effectiveTreadDot(
  asset: { treadMm: number | null; dot: string | null },
  fitment: { treadMm: number | null; dot: string | null } | undefined,
): { treadMm: number | null; dot: string | null } {
  let treadMm = asset.treadMm;
  let dot = asset.dot;
  if (fitment) {
    if (treadMm == null && fitment.treadMm != null) treadMm = fitment.treadMm;
    if ((dot == null || !dot.trim()) && fitment.dot?.trim()) dot = fitment.dot;
  }
  return { treadMm, dot };
}

export type ApplyRecommendedReplaceResult = { updated: number };

/**
 * Sets recommendedReplace=true when tread/DOT fail thresholds (never auto-clears for pilot).
 * Marks attrs.autoRecommendedReplace when the flag is raised automatically.
 */
export async function applyRecommendedReplaceFlags(
  db: DbClient,
  tenantId: string,
  vehicleIds?: string[],
  now = new Date(),
): Promise<ApplyRecommendedReplaceResult> {
  const result: ApplyRecommendedReplaceResult = { updated: 0 };

  if (vehicleIds != null && vehicleIds.length === 0) {
    return result;
  }

  const setWhere: Prisma.TireSetWhereInput = {
    tenantId,
    archivedAt: null,
    ...(vehicleIds != null ? { vehicleId: { in: vehicleIds } } : {}),
  };

  const items = await db.tireSetItem.findMany({
    where: { set: setWhere },
    select: {
      asset: {
        select: {
          id: true,
          treadMm: true,
          dot: true,
          season: true,
          recommendedReplace: true,
          attrs: true,
        },
      },
    },
  });

  const assetById = new Map<string, (typeof items)[number]['asset']>();
  for (const item of items) {
    assetById.set(item.asset.id, item.asset);
  }

  const scopeVehicleIds =
    vehicleIds ??
    (
      await db.tireSet.findMany({
        where: setWhere,
        select: { vehicleId: true },
        distinct: ['vehicleId'],
      })
    ).map((s) => s.vehicleId);

  if (scopeVehicleIds.length === 0 && vehicleIds == null) {
    return result;
  }

  const placements =
    scopeVehicleIds.length === 0
      ? []
      : await db.tirePlacement.findMany({
          where: {
            tenantId,
            kind: 'on_vehicle',
            validTo: null,
            vehicleId: { in: scopeVehicleIds },
          },
          select: { assetId: true, vehicleId: true, position: true },
        });

  const fitments =
    scopeVehicleIds.length === 0
      ? []
      : await db.vehicleWheelFitment.findMany({
          where: { vehicleId: { in: scopeVehicleIds } },
          select: { vehicleId: true, position: true, treadMm: true, dot: true },
        });

  const fitmentByKey = new Map(
    fitments.map((f) => [`${f.vehicleId}:${f.position}`, f] as const),
  );

  for (const pl of placements) {
    if (!pl.assetId || !pl.vehicleId || !pl.position) continue;
    if (!assetById.has(pl.assetId)) {
      const row = await db.tireAsset.findFirst({
        where: { id: pl.assetId, tenantId },
        select: {
          id: true,
          treadMm: true,
          dot: true,
          season: true,
          recommendedReplace: true,
          attrs: true,
        },
      });
      if (row) assetById.set(row.id, row);
    }
  }

  for (const asset of assetById.values()) {
    const placement = placements.find((p) => p.assetId === asset.id);
    const fitment =
      placement?.vehicleId && placement.position
        ? fitmentByKey.get(`${placement.vehicleId}:${placement.position}`)
        : undefined;

    const { treadMm, dot } = effectiveTreadDot(asset, fitment);
    const fails = isTreadLow(treadMm, asset.season) || isDotAged(dot, now);

    if (!fails) {
      continue;
    }

    if (asset.recommendedReplace) {
      continue;
    }

    const prevAttrs = readAttrsRecord(asset.attrs);
    await db.tireAsset.update({
      where: { id: asset.id },
      data: {
        recommendedReplace: true,
        attrs: { ...prevAttrs, autoRecommendedReplace: true },
      },
    });
    result.updated += 1;
  }

  return result;
}
