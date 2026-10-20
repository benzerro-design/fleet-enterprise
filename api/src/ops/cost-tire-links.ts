import { BadRequestException } from '@nestjs/common';
import { Prisma, ServiceOrderType } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

export type TireCostLinkFields = {
  tireAssetId?: string | null;
  tireSetId?: string | null;
  tireStorageStayId?: string | null;
};

export type ResolvedTireCostLinks = {
  tireAssetId?: string | null;
  tireSetId?: string | null;
  tireStorageStayId?: string | null;
};

export function isTireCostCategory(category: string): boolean {
  return category.trim().toLowerCase() === 'anvelope';
}

export function allowsTireCostLinks(
  category: string,
  serviceOrderType?: ServiceOrderType | null,
): boolean {
  return isTireCostCategory(category) || serviceOrderType === ServiceOrderType.R;
}

type Db = PrismaService | Prisma.TransactionClient;

export async function resolveTireCostLinksForVehicle(
  db: Db,
  tenantId: string,
  vehicleId: string,
  input: TireCostLinkFields,
  opts?: { allowLinks: boolean },
): Promise<ResolvedTireCostLinks | undefined> {
  const hasAny =
    'tireAssetId' in input || 'tireSetId' in input || 'tireStorageStayId' in input;
  if (!hasAny) return undefined;

  if (opts?.allowLinks === false) {
    throw new BadRequestException('Tire cost links are only allowed for Anvelope or work order type R');
  }

  const tireAssetId =
    input.tireAssetId === undefined
      ? undefined
      : input.tireAssetId?.trim()
        ? input.tireAssetId.trim()
        : null;
  const tireSetId =
    input.tireSetId === undefined
      ? undefined
      : input.tireSetId?.trim()
        ? input.tireSetId.trim()
        : null;
  const tireStorageStayId =
    input.tireStorageStayId === undefined
      ? undefined
      : input.tireStorageStayId?.trim()
        ? input.tireStorageStayId.trim()
        : null;

  if (tireAssetId) {
    const asset = await db.tireAsset.findFirst({
      where: {
        id: tireAssetId,
        tenantId,
        OR: [
          { placements: { some: { vehicleId, validTo: null } } },
          { setItems: { some: { set: { vehicleId } } } },
        ],
      },
      select: { id: true },
    });
    if (!asset) throw new BadRequestException('tireAssetId not found for this vehicle');
  }

  if (tireSetId) {
    const set = await db.tireSet.findFirst({
      where: { id: tireSetId, tenantId, vehicleId },
      select: { id: true },
    });
    if (!set) throw new BadRequestException('tireSetId not found for this vehicle');
  }

  if (tireStorageStayId) {
    const stay = await db.tireStorageStay.findFirst({
      where: { id: tireStorageStayId, tenantId, set: { vehicleId } },
      select: { id: true },
    });
    if (!stay) throw new BadRequestException('tireStorageStayId not found for this vehicle');
  }

  const out: ResolvedTireCostLinks = {};
  if (input.tireAssetId !== undefined) out.tireAssetId = tireAssetId ?? null;
  if (input.tireSetId !== undefined) out.tireSetId = tireSetId ?? null;
  if (input.tireStorageStayId !== undefined) out.tireStorageStayId = tireStorageStayId ?? null;
  return out;
}

export async function inferTireCostLinksFromTyreClose(
  db: Db,
  tenantId: string,
  vehicleId: string,
  workOrderId: string,
  seasonalSwap?: {
    demountSetId: string;
    mountSetId: string;
    storeAt: 'at_supplier_hotel' | 'at_client';
  } | null,
): Promise<ResolvedTireCostLinks | null> {
  if (seasonalSwap) {
    let tireStorageStayId: string | null = null;
    if (seasonalSwap.storeAt === 'at_supplier_hotel') {
      const stay = await db.tireStorageStay.findFirst({
        where: {
          tenantId,
          setId: seasonalSwap.demountSetId,
          checkOutAt: null,
        },
        orderBy: { checkInAt: 'desc' },
        select: { id: true },
      });
      tireStorageStayId = stay?.id ?? null;
    }
    return {
      tireSetId: seasonalSwap.mountSetId,
      tireAssetId: null,
      tireStorageStayId,
    };
  }

  const events = await db.tireEvent.findMany({
    where: { tenantId, workOrderId, vehicleId },
    orderBy: { createdAt: 'desc' },
    select: { type: true, assetId: true, setId: true, payload: true },
  });
  if (events.length === 0) return null;

  let mountSetId: string | null = null;
  let demountSetId: string | null = null;
  let storageStayIdFromEvent: string | null = null;

  for (const ev of events) {
    const payload =
      ev.payload && typeof ev.payload === 'object' && !Array.isArray(ev.payload)
        ? (ev.payload as Record<string, unknown>)
        : null;
    if (payload) {
      if (typeof payload.storageStayId === 'string' && payload.storageStayId.trim()) {
        storageStayIdFromEvent = payload.storageStayId.trim();
      }
      if (typeof payload.mountSetId === 'string' && payload.mountSetId.trim() && !mountSetId) {
        mountSetId = payload.mountSetId.trim();
      }
      if (typeof payload.demountSetId === 'string' && payload.demountSetId.trim() && !demountSetId) {
        demountSetId = payload.demountSetId.trim();
      }
    }
    if (ev.type === 'mount' && ev.setId && !mountSetId) mountSetId = ev.setId;
    if (ev.type === 'demount' && ev.setId && !demountSetId) demountSetId = ev.setId;
    if (ev.type === 'store' && ev.setId && !demountSetId) demountSetId = ev.setId;
  }

  let tireStorageStayId: string | null = storageStayIdFromEvent;
  if (!tireStorageStayId) {
    for (const setId of [demountSetId, mountSetId]) {
      if (!setId) continue;
      const stay = await db.tireStorageStay.findFirst({
        where: { tenantId, setId, checkOutAt: null },
        orderBy: { checkInAt: 'desc' },
        select: { id: true },
      });
      if (stay) {
        tireStorageStayId = stay.id;
        break;
      }
    }
  }

  if (mountSetId || demountSetId || tireStorageStayId) {
    return {
      tireSetId: mountSetId ?? demountSetId,
      tireAssetId: null,
      tireStorageStayId,
    };
  }

  const event = events[0]!;
  return {
    tireAssetId: event.assetId,
    tireSetId: event.setId,
    tireStorageStayId,
  };
}

/** Attach tire FKs on WO quote costs missing links after tyre-close (call inside tyre-close tx). */
export async function attachTireLinksToWorkOrderCosts(
  db: Db,
  tenantId: string,
  vehicleId: string,
  workOrderId: string,
  seasonalSwap?: {
    demountSetId: string;
    mountSetId: string;
    storeAt: 'at_supplier_hotel' | 'at_client';
  } | null,
): Promise<void> {
  const inferred = await inferTireCostLinksFromTyreClose(
    db,
    tenantId,
    vehicleId,
    workOrderId,
    seasonalSwap,
  );
  if (!inferred) return;

  const quotes = await db.workOrderQuote.findMany({
    where: { tenantId, workOrderId, costEntryId: { not: null } },
    select: { costEntryId: true },
  });
  const costIds = quotes.map((q) => q.costEntryId!).filter(Boolean);
  if (costIds.length === 0) return;

  for (const costId of costIds) {
    const cost = await db.costEntry.findFirst({
      where: { id: costId, tenantId },
      select: {
        tireAssetId: true,
        tireSetId: true,
        tireStorageStayId: true,
      },
    });
    if (!cost) continue;
    const patch: Prisma.CostEntryUpdateInput = {};
    if (!cost.tireSetId && inferred.tireSetId) patch.tireSet = { connect: { id: inferred.tireSetId } };
    if (!cost.tireAssetId && inferred.tireAssetId) {
      patch.tireAsset = { connect: { id: inferred.tireAssetId } };
    }
    if (!cost.tireStorageStayId && inferred.tireStorageStayId) {
      patch.tireStorageStay = { connect: { id: inferred.tireStorageStayId } };
    }
    if (Object.keys(patch).length === 0) continue;
    await db.costEntry.update({ where: { id: costId }, data: patch });
  }
}
