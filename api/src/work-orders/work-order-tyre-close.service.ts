import { BadRequestException, Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import {
  Prisma,
  ServiceOrderType,
  VehicleWheelPosition,
  type TirePlacementKind,
} from '@prisma/client';
import type { AccessContext } from '../iam/access-context.types';
import { TireDomainService } from '../fleet/tires/tire-domain.service';
import { TireHotelService } from '../fleet/tires/tire-hotel.service';
import { POSITION_SORT_ORDER } from '../fleet/tires/tire-domain.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  TYRE_WORK_INTENTS,
  type TyreCloseDto,
  type TyreClosePositionOutcome,
  type TyreWorkIntent,
} from './work-order-tyre-close.types';
import { WorkOrdersService } from './work-orders.service';
import { attachTireLinksToWorkOrderCosts } from '../ops/cost-tire-links';
import { applyRecommendedReplaceFlags } from '../fleet/tires/tire-recommended-replace';

const ALL_POSITIONS = new Set<string>(POSITION_SORT_ORDER);

/** Optimistic claim inside tyre-close transaction — count 0 means another request won the race. */
export function rejectIfTyreCloseAlreadyClaimed(claimedCount: number): void {
  if (claimedCount === 0) {
    throw new BadRequestException('Tyre close already applied for this work order');
  }
}

function parseIntent(raw: unknown): TyreWorkIntent {
  if (typeof raw !== 'string' || !TYRE_WORK_INTENTS.includes(raw as TyreWorkIntent)) {
    throw new BadRequestException(`intent must be one of: ${TYRE_WORK_INTENTS.join(', ')}`);
  }
  return raw as TyreWorkIntent;
}

export function assertTyreCloseDto(body: unknown): TyreCloseDto {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('Body must be an object');
  }
  const o = body as Record<string, unknown>;
  const intent = parseIntent(o.intent);
  const odometerKm =
    o.odometerKm === undefined || o.odometerKm === null
      ? undefined
      : Number.isFinite(Number(o.odometerKm)) && Number(o.odometerKm) >= 0
        ? Math.round(Number(o.odometerKm))
        : (() => {
            throw new BadRequestException('odometerKm must be a non-negative integer');
          })();

  let seasonalSwap: TyreCloseDto['seasonalSwap'];
  if (o.seasonalSwap !== undefined && o.seasonalSwap !== null) {
    if (typeof o.seasonalSwap !== 'object' || Array.isArray(o.seasonalSwap)) {
      throw new BadRequestException('seasonalSwap must be an object');
    }
    const s = o.seasonalSwap as Record<string, unknown>;
    const demountSetId = typeof s.demountSetId === 'string' ? s.demountSetId.trim() : '';
    const mountSetId = typeof s.mountSetId === 'string' ? s.mountSetId.trim() : '';
    const storeAt = s.storeAt;
    if (!demountSetId || !mountSetId) {
      throw new BadRequestException('seasonalSwap requires demountSetId and mountSetId');
    }
    if (storeAt !== 'at_supplier_hotel' && storeAt !== 'at_client') {
      throw new BadRequestException('seasonalSwap.storeAt must be at_supplier_hotel or at_client');
    }
    seasonalSwap = { demountSetId, mountSetId, storeAt };
  }

  let outcomes: TyreClosePositionOutcome[] | undefined;
  if (o.outcomes !== undefined && o.outcomes !== null) {
    if (!Array.isArray(o.outcomes)) throw new BadRequestException('outcomes must be an array');
    outcomes = o.outcomes.map((row, idx) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw new BadRequestException(`outcomes[${idx}] invalid`);
      }
      const r = row as Record<string, unknown>;
      const position = r.position;
      if (typeof position !== 'string' || !ALL_POSITIONS.has(position)) {
        throw new BadRequestException(`outcomes[${idx}].position invalid`);
      }
      const outcome = r.outcome;
      if (outcome === 'seasonal_swap') {
        throw new BadRequestException(
          `outcomes[${idx}].outcome seasonal_swap is intent-level only; use seasonalSwap on the request body`,
        );
      }
      const allowed = ['repaired', 'replaced', 'inspected_ok', 'deferred'];
      if (typeof outcome !== 'string' || !allowed.includes(outcome)) {
        throw new BadRequestException(`outcomes[${idx}].outcome invalid`);
      }
      const treadMm =
        r.treadMm === undefined || r.treadMm === null
          ? undefined
          : Number.isFinite(Number(r.treadMm))
            ? Number(r.treadMm)
            : (() => {
                throw new BadRequestException(`outcomes[${idx}].treadMm invalid`);
              })();
      const dot = r.dot === undefined || r.dot === null ? undefined : String(r.dot);
      let newAsset: TyreClosePositionOutcome['newAsset'];
      if (r.newAsset !== undefined && r.newAsset !== null) {
        if (typeof r.newAsset !== 'object' || Array.isArray(r.newAsset)) {
          throw new BadRequestException(`outcomes[${idx}].newAsset invalid`);
        }
        const na = r.newAsset as Record<string, unknown>;
        newAsset = {
          size: na.size === undefined ? undefined : na.size === null ? null : String(na.size),
          brand: na.brand === undefined ? undefined : na.brand === null ? null : String(na.brand),
          model: na.model === undefined ? undefined : na.model === null ? null : String(na.model),
          season:
            na.season === undefined ? undefined : na.season === null ? null : String(na.season),
          dot: na.dot === undefined ? undefined : na.dot === null ? null : String(na.dot),
          treadMm:
            na.treadMm === undefined || na.treadMm === null
              ? undefined
              : Number.isFinite(Number(na.treadMm))
                ? Number(na.treadMm)
                : undefined,
          speedIndex:
            na.speedIndex === undefined
              ? undefined
              : na.speedIndex === null
                ? null
                : String(na.speedIndex),
          loadIndex:
            na.loadIndex === undefined
              ? undefined
              : na.loadIndex === null
                ? null
                : String(na.loadIndex),
          commercialC: typeof na.commercialC === 'boolean' ? na.commercialC : undefined,
        };
      }
      const disposeAs = r.disposeAs === 'quarantine' ? 'quarantine' : r.disposeAs === 'scrap' ? 'scrap' : undefined;
      return {
        position: position as VehicleWheelPosition,
        outcome: outcome as TyreClosePositionOutcome['outcome'],
        treadMm,
        dot,
        newAsset,
        disposeAs,
      };
    });
  }

  if (!seasonalSwap && (!outcomes || outcomes.length === 0)) {
    throw new BadRequestException('Provide seasonalSwap or at least one position outcome');
  }

  return { intent, odometerKm, seasonalSwap, outcomes };
}

@Injectable()
export class WorkOrderTyreCloseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tires: TireDomainService,
    private readonly tireHotel: TireHotelService,
    @Inject(forwardRef(() => WorkOrdersService))
    private readonly workOrders: WorkOrdersService,
  ) {}

  /** Tire set picker for tyre-close UI — partners use WO scope instead of fleet vehicle wheels. */
  async listTireSetsForWorkOrder(
    tenantSlug: string,
    workOrderId: string,
    access?: AccessContext,
  ) {
    const wo = await this.prisma.maintenanceWorkOrder.findFirst({
      where: { id: workOrderId, tenant: { slug: tenantSlug } },
      select: {
        id: true,
        vehicleId: true,
        supplierId: true,
        vehicle: { select: { clientId: true } },
      },
    });
    if (!wo) throw new NotFoundException('Work order not found');
    if (access) {
      this.workOrders.assertWorkOrderRead(access, {
        supplierId: wo.supplierId,
        vehicle: { clientId: wo.vehicle.clientId },
      });
    }
    await this.tires.ensureMountedSetFromFitmentInternal(tenantSlug, wo.vehicleId);
    const sets = await this.tires.listSetsForVehicleInternal(tenantSlug, wo.vehicleId);
    return {
      sets: sets.map((s) => ({
        id: s.id,
        season: s.season,
        name: s.name,
        isMounted: s.isMounted,
        itemCount: s.itemCount,
      })),
    };
  }

  async applyTyreClose(
    tenantSlug: string,
    workOrderId: string,
    dto: TyreCloseDto,
    actorUserId?: string,
    access?: AccessContext,
  ) {
    const wo = await this.prisma.maintenanceWorkOrder.findFirst({
      where: { id: workOrderId, tenant: { slug: tenantSlug } },
      include: {
        vehicle: { select: { id: true, clientId: true, tenantId: true } },
        serviceCase: { select: { clientId: true } },
      },
    });
    if (!wo) throw new NotFoundException('Work order not found');
    if (wo.serviceOrderType !== ServiceOrderType.R) {
      throw new BadRequestException('Tyre close applies only to work orders of type R');
    }
    if (wo.tyreCloseAppliedAt) {
      throw new BadRequestException('Tyre close already applied for this work order');
    }

    if (access) {
      this.workOrders.assertWorkOrderWrite(access, {
        supplierId: wo.supplierId,
        vehicle: { clientId: wo.vehicle.clientId },
      });
    }

    const tenantId = wo.tenantId;
    const vehicleId = wo.vehicleId;
    const clientId = wo.vehicle.clientId;
    const supplierId = wo.supplierId;
    const odometerKm = dto.odometerKm ?? wo.odometerKmOut ?? wo.odometerKmIn ?? null;

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.maintenanceWorkOrder.updateMany({
        where: { id: workOrderId, tyreCloseAppliedAt: null },
        data: {
          tyreCloseAppliedAt: new Date('1970-01-01T00:00:00.000Z'),
          tyreWorkIntent: dto.intent,
        },
      });
      rejectIfTyreCloseAlreadyClaimed(claimed.count);

      if (dto.seasonalSwap) {
        await this.applySeasonalSwapTx(tx, {
          tenantId,
          vehicleId,
          clientId,
          workOrderId,
          supplierId,
          actorUserId,
          odometerKm,
          swap: dto.seasonalSwap,
        });
      }

      if (dto.outcomes?.length) {
        for (const outcome of dto.outcomes) {
          await this.applyPositionOutcomeTx(tx, {
            tenantId,
            vehicleId,
            clientId,
            workOrderId,
            supplierId,
            actorUserId,
            odometerKm,
            outcome,
          });
        }
      }

      await this.tires.syncFitmentProjectionTx(tx, tenantId, vehicleId);

      await applyRecommendedReplaceFlags(tx, tenantId, [vehicleId]);

      await tx.maintenanceWorkOrder.update({
        where: { id: workOrderId },
        data: { tyreCloseAppliedAt: new Date() },
      });

      await attachTireLinksToWorkOrderCosts(
        tx,
        tenantId,
        vehicleId,
        workOrderId,
        dto.seasonalSwap ?? null,
      );
    });

    return this.workOrders.getById(tenantSlug, workOrderId, access);
  }

  private async applySeasonalSwapTx(
    tx: Prisma.TransactionClient,
    ctx: {
      tenantId: string;
      vehicleId: string;
      clientId: string;
      workOrderId: string;
      supplierId: string | null;
      actorUserId?: string;
      odometerKm: number | null;
      swap: NonNullable<TyreCloseDto['seasonalSwap']>;
    },
  ): Promise<void> {
    const storeKind: TirePlacementKind = ctx.swap.storeAt;
    if (storeKind === 'at_supplier_hotel' && !ctx.supplierId) {
      throw new BadRequestException(
        'seasonalSwap.storeAt at_supplier_hotel requires work order supplierId',
      );
    }
    if (ctx.swap.demountSetId === ctx.swap.mountSetId) {
      throw new BadRequestException('seasonalSwap demountSetId and mountSetId must differ');
    }

    const demountSet = await tx.tireSet.findFirst({
      where: {
        id: ctx.swap.demountSetId,
        tenantId: ctx.tenantId,
        vehicleId: ctx.vehicleId,
        archivedAt: null,
      },
      select: { id: true },
    });
    const mountSet = await tx.tireSet.findFirst({
      where: {
        id: ctx.swap.mountSetId,
        tenantId: ctx.tenantId,
        vehicleId: ctx.vehicleId,
        archivedAt: null,
      },
      select: { id: true },
    });
    if (!demountSet) {
      throw new BadRequestException('seasonalSwap demountSetId not found for this vehicle/tenant');
    }
    if (!mountSet) {
      throw new BadRequestException('seasonalSwap mountSetId not found for this vehicle/tenant');
    }

    const demountItems = await tx.tireSetItem.findMany({
      where: { setId: ctx.swap.demountSetId },
      select: { assetId: true },
    });
    const demountAssetIds = new Set(demountItems.map((i) => i.assetId));

    const mountItems = await tx.tireSetItem.findMany({
      where: { setId: ctx.swap.mountSetId },
      orderBy: [{ sortOrder: 'asc' }, { assetId: 'asc' }],
    });
    if (mountItems.length === 0) {
      throw new BadRequestException('seasonalSwap mount set has no tyre assets');
    }

    const mounted = await tx.tirePlacement.findMany({
      where: {
        vehicleId: ctx.vehicleId,
        kind: 'on_vehicle',
        validTo: null,
      },
      orderBy: { position: 'asc' },
    });

    const toDemount = mounted.filter(
      (pl) => pl.setId === ctx.swap.demountSetId || demountAssetIds.has(pl.assetId),
    );
    const onVehicleDemount = toDemount.filter((pl) => !!pl.position);
    if (onVehicleDemount.length === 0) {
      throw new BadRequestException('seasonalSwap demount set has no tyres currently on vehicle');
    }
    if (mountItems.length !== onVehicleDemount.length) {
      throw new BadRequestException(
        `seasonalSwap mount set item count (${mountItems.length}) must match demount on-vehicle count (${onVehicleDemount.length})`,
      );
    }

    const freedPositions: VehicleWheelPosition[] = [];

    for (const pl of onVehicleDemount) {
      if (!pl.position) continue;

      const now = new Date();
      await tx.tirePlacement.update({
        where: { id: pl.id },
        data: { validTo: now },
      });
      await tx.tireEvent.create({
        data: {
          tenantId: ctx.tenantId,
          type: 'demount',
          assetId: pl.assetId,
          setId: pl.setId,
          vehicleId: ctx.vehicleId,
          workOrderId: ctx.workOrderId,
          odometerKm: ctx.odometerKm,
          actorUserId: ctx.actorUserId ?? undefined,
          payload: { source: 'tyre_close_seasonal', position: pl.position },
        },
      });

      await this.tires.placeAssetTx(tx, {
        tenantId: ctx.tenantId,
        assetId: pl.assetId,
        kind: storeKind,
        supplierId: storeKind === 'at_supplier_hotel' ? ctx.supplierId : undefined,
        setId: pl.setId ?? ctx.swap.demountSetId,
        eventType: 'store',
        vehicleIdForEvent: ctx.vehicleId,
        workOrderId: ctx.workOrderId,
        actorUserId: ctx.actorUserId,
        payload: { source: 'tyre_close_seasonal', demountSetId: ctx.swap.demountSetId },
      });

      freedPositions.push(pl.position);
    }

    if (storeKind === 'at_supplier_hotel' && ctx.supplierId) {
      await this.tireHotel.recordStayAfterStoreTx(tx, {
        tenantId: ctx.tenantId,
        supplierId: ctx.supplierId,
        setId: ctx.swap.demountSetId,
        workOrderId: ctx.workOrderId,
        sourceSystem: 'tyre_close_seasonal',
      });
    }

    freedPositions.sort(
      (a, b) => POSITION_SORT_ORDER.indexOf(a) - POSITION_SORT_ORDER.indexOf(b),
    );

    if (freedPositions.length !== mountItems.length) {
      throw new BadRequestException(
        'seasonalSwap could not resolve wheel positions for all demounted tyres',
      );
    }

    for (let i = 0; i < mountItems.length; i++) {
      const position = freedPositions[i]!;
      const assetId = mountItems[i]!.assetId;
      await this.tires.placeAssetTx(tx, {
        tenantId: ctx.tenantId,
        assetId,
        kind: 'on_vehicle',
        vehicleId: ctx.vehicleId,
        position,
        setId: ctx.swap.mountSetId,
        eventType: 'mount',
        workOrderId: ctx.workOrderId,
        actorUserId: ctx.actorUserId,
        payload: { source: 'tyre_close_seasonal', mountSetId: ctx.swap.mountSetId, position },
      });
    }
  }

  private async applyPositionOutcomeTx(
    tx: Prisma.TransactionClient,
    ctx: {
      tenantId: string;
      vehicleId: string;
      clientId: string;
      workOrderId: string;
      supplierId: string | null;
      actorUserId?: string;
      odometerKm: number | null;
      outcome: TyreClosePositionOutcome;
    },
  ): Promise<void> {
    const { outcome } = ctx;
    const active = await tx.tirePlacement.findFirst({
      where: {
        vehicleId: ctx.vehicleId,
        position: outcome.position,
        kind: 'on_vehicle',
        validTo: null,
      },
      include: { asset: { include: { rimAsset: true } } },
    });

    if (outcome.outcome === 'seasonal_swap') {
      throw new BadRequestException(
        'Position outcome seasonal_swap is not allowed; use seasonalSwap on the request body',
      );
    }

    if (outcome.outcome === 'deferred') {
      return;
    }

    if (outcome.outcome === 'inspected_ok') {
      await tx.tireEvent.create({
        data: {
          tenantId: ctx.tenantId,
          type: 'inspect',
          assetId: active?.assetId,
          vehicleId: ctx.vehicleId,
          workOrderId: ctx.workOrderId,
          odometerKm: ctx.odometerKm,
          actorUserId: ctx.actorUserId ?? undefined,
          payload: { source: 'tyre_close', position: outcome.position, result: 'ok' },
        },
      });
      return;
    }

    if (outcome.outcome === 'repaired') {
      if (!active) {
        throw new BadRequestException(`No mounted tyre at position ${outcome.position}`);
      }
      const data: Prisma.TireAssetUpdateInput = {};
      if (outcome.treadMm !== undefined) data.treadMm = outcome.treadMm;
      if (outcome.dot !== undefined) data.dot = outcome.dot;
      if (Object.keys(data).length > 0) {
        await tx.tireAsset.update({ where: { id: active.assetId }, data });
      }
      await tx.tireEvent.create({
        data: {
          tenantId: ctx.tenantId,
          type: 'repair',
          assetId: active.assetId,
          setId: active.setId,
          vehicleId: ctx.vehicleId,
          workOrderId: ctx.workOrderId,
          odometerKm: ctx.odometerKm,
          actorUserId: ctx.actorUserId ?? undefined,
          payload: {
            source: 'tyre_close',
            position: outcome.position,
            treadMm: outcome.treadMm,
            dot: outcome.dot,
          },
        },
      });
      return;
    }

    if (outcome.outcome === 'replaced') {
      if (!active) {
        throw new BadRequestException(`No mounted tyre at position ${outcome.position}`);
      }
      if (!outcome.newAsset) {
        throw new BadRequestException(`replaced at ${outcome.position} requires newAsset`);
      }
      const na = outcome.newAsset;
      const season =
        na.season && ['summer', 'winter', 'all_season', 'unknown'].includes(na.season)
          ? (na.season as import('@prisma/client').VehicleTireSeason)
          : active.asset.season;

      const now = new Date();
      await tx.tirePlacement.update({
        where: { id: active.id },
        data: { validTo: now },
      });
      await tx.tireEvent.create({
        data: {
          tenantId: ctx.tenantId,
          type: 'demount',
          assetId: active.assetId,
          setId: active.setId,
          vehicleId: ctx.vehicleId,
          workOrderId: ctx.workOrderId,
          odometerKm: ctx.odometerKm,
          actorUserId: ctx.actorUserId ?? undefined,
          payload: { source: 'tyre_close_replace', position: outcome.position },
        },
      });

      const disposeKind = outcome.disposeAs === 'quarantine' ? 'quarantine' : 'scrap';
      const quarantine = disposeKind === 'quarantine';
      await this.tires.placeAssetTx(tx, {
        tenantId: ctx.tenantId,
        assetId: active.assetId,
        kind: disposeKind,
        setId: active.setId,
        eventType: 'scrap',
        workOrderId: ctx.workOrderId,
        actorUserId: ctx.actorUserId,
        payload: {
          source: 'tyre_close_replace',
          position: outcome.position,
          ...(quarantine ? { quarantine: true } : {}),
        },
      });

      if (active.setId) {
        await tx.tireSetItem.deleteMany({
          where: { setId: active.setId, assetId: active.assetId },
        });
      }

      const newAsset = await tx.tireAsset.create({
        data: {
          tenantId: ctx.tenantId,
          clientId: ctx.clientId,
          ownerClientId: ctx.clientId,
          ownershipType: 'client',
          provenance: 'verified',
          rimAssetId: active.asset.rimAssetId ?? undefined,
          size: na.size ?? active.asset.size,
          brand: na.brand ?? active.asset.brand,
          model: na.model ?? active.asset.model,
          season,
          speedIndex: na.speedIndex ?? active.asset.speedIndex,
          loadIndex: na.loadIndex ?? active.asset.loadIndex,
          commercialC: na.commercialC ?? active.asset.commercialC,
          dot: na.dot ?? null,
          treadMm: na.treadMm ?? null,
        },
      });

      await tx.tireEvent.create({
        data: {
          tenantId: ctx.tenantId,
          type: 'purchase',
          assetId: newAsset.id,
          vehicleId: ctx.vehicleId,
          workOrderId: ctx.workOrderId,
          odometerKm: ctx.odometerKm,
          actorUserId: ctx.actorUserId ?? undefined,
          payload: { source: 'tyre_close_replace', position: outcome.position },
        },
      });

      if (active.setId) {
        await tx.tireSetItem.upsert({
          where: {
            setId_assetId: { setId: active.setId, assetId: newAsset.id },
          },
          create: {
            setId: active.setId,
            assetId: newAsset.id,
            sortOrder: POSITION_SORT_ORDER.indexOf(outcome.position),
          },
          update: { sortOrder: POSITION_SORT_ORDER.indexOf(outcome.position) },
        });
      }

      await this.tires.placeAssetTx(tx, {
        tenantId: ctx.tenantId,
        assetId: newAsset.id,
        kind: 'on_vehicle',
        vehicleId: ctx.vehicleId,
        position: outcome.position,
        setId: active.setId,
        eventType: 'mount',
        workOrderId: ctx.workOrderId,
        actorUserId: ctx.actorUserId,
        payload: { source: 'tyre_close_replace', position: outcome.position },
      });
    }
  }
}
