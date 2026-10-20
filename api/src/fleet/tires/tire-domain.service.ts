import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  Prisma,
  TireEventType,
  TirePlacementKind,
  VehicleRimMaterial,
  VehicleTireSeason,
  VehicleWheelPosition,
} from '@prisma/client';
import type { AccessContext } from '../../iam/access-context.types';
import { assertVehicleOpsRead, assertVehicleOpsWrite } from '../../ops/ops-write-access';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateTireSetDto, FitmentSyncFields, PlaceAssetParams, TireSetSummary } from './tire-domain.types';
import { tireSetQrPayload } from './tire-domain.types';
import { positionSortIndex } from './tire-domain.types';

type Db = PrismaService | Prisma.TransactionClient;

const MOUNTED_SET_NAME = 'Montat';
const CREATE_SET_SEASONS: VehicleTireSeason[] = ['summer', 'winter', 'all_season'];
type SeedSpecSource = {
  position: VehicleWheelPosition;
  size: string | null;
  brand: string | null;
  model: string | null;
  speedIndex: string | null;
  loadIndex: string | null;
  commercialC: boolean;
  rimSize: string | null;
  rimMaterial: VehicleRimMaterial | null;
  lugNutCount: number | null;
};

function positionHasSpecData(fields: {
  size?: string | null;
  brand?: string | null;
  model?: string | null;
}): boolean {
  return Boolean(
    (fields.size && fields.size.trim()) ||
      (fields.brand && fields.brand.trim()) ||
      (fields.model && fields.model.trim()),
  );
}

function hasRimFields(fields: FitmentSyncFields): boolean {
  return Boolean(
    (fields.rimSize && fields.rimSize.trim()) ||
      fields.rimMaterial ||
      (fields.lugNutCount != null && fields.lugNutCount > 0),
  );
}

function assetDataFromFitment(fields: FitmentSyncFields): Prisma.TireAssetUncheckedUpdateInput {
  return {
    size: fields.size === undefined ? undefined : fields.size,
    brand: fields.brand === undefined ? undefined : fields.brand,
    model: fields.model === undefined ? undefined : fields.model,
    season: fields.season,
    speedIndex: fields.speedIndex === undefined ? undefined : fields.speedIndex,
    loadIndex: fields.loadIndex === undefined ? undefined : fields.loadIndex,
    commercialC: fields.commercialC,
    dot: fields.dot === undefined ? undefined : fields.dot,
    treadMm: fields.treadMm === undefined ? undefined : fields.treadMm,
  };
}

function pickSetSeason(seasons: VehicleTireSeason[]): VehicleTireSeason {
  const known = seasons.filter((s) => s !== 'unknown');
  if (known.length === 0) return 'unknown';
  const first = known[0];
  return known.every((s) => s === first) ? first : 'unknown';
}

@Injectable()
export class TireDomainService {
  constructor(private readonly prisma: PrismaService) {}

  async listSetsForVehicle(
    tenantSlug: string,
    vehicleId: string,
    access?: AccessContext,
  ): Promise<TireSetSummary[]> {
    await assertVehicleOpsRead(this.prisma, tenantSlug, vehicleId, access);
    return this.listSetsForVehicleInternal(tenantSlug, vehicleId);
  }

  /** Caller must enforce access (e.g. work-order read for partner tyre-close). */
  async listSetsForVehicleInternal(
    tenantSlug: string,
    vehicleId: string,
  ): Promise<TireSetSummary[]> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenant: { slug: tenantSlug } },
      select: { id: true },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const sets = await this.prisma.tireSet.findMany({
      where: { vehicleId, archivedAt: null },
      orderBy: [{ createdAt: 'asc' }],
      include: {
        _count: { select: { items: true } },
        placements: {
          where: { validTo: null, kind: 'on_vehicle', vehicleId },
          select: { id: true },
          take: 1,
        },
        storageStays: {
          where: { checkOutAt: null },
          orderBy: { checkInAt: 'desc' },
          take: 1,
          include: { supplier: { select: { legalName: true } } },
        },
      },
    });

    const setIds = sets.map((s) => s.id);
    const hotelPlacements =
      setIds.length === 0
        ? []
        : await this.prisma.tirePlacement.findMany({
            where: {
              setId: { in: setIds },
              kind: 'at_supplier_hotel',
              validTo: null,
            },
            include: { supplier: { select: { legalName: true } } },
            orderBy: { validFrom: 'desc' },
          });
    const placementBySet = new Map<string, (typeof hotelPlacements)[number]>();
    for (const pl of hotelPlacements) {
      if (pl.setId && !placementBySet.has(pl.setId)) {
        placementBySet.set(pl.setId, pl);
      }
    }

    return sets.map((s) => {
      const stay = s.storageStays[0];
      const pl = placementBySet.get(s.id);
      const atHotel = Boolean(stay || pl);
      const hotel =
        atHotel
          ? {
              atSupplierHotel: true,
              supplierName: stay?.supplier.legalName ?? pl?.supplier?.legalName ?? null,
              locationCode: stay?.locationCode ?? pl?.locationCode ?? null,
              checkInAt: stay?.checkInAt.toISOString() ?? pl?.validFrom.toISOString() ?? null,
            }
          : null;

      return {
        id: s.id,
        season: s.season,
        name: s.name,
        mountedAs: s.mountedAs,
        archivedAt: s.archivedAt ? s.archivedAt.toISOString() : null,
        itemCount: s._count.items,
        isMounted: s.placements.length > 0,
        hotel,
        qrPayload: tireSetQrPayload(s.id),
      };
    });
  }

  async ensureMountedSetFromFitment(
    tenantSlug: string,
    vehicleId: string,
    access?: AccessContext,
  ): Promise<void> {
    await assertVehicleOpsRead(this.prisma, tenantSlug, vehicleId, access);
    await this.ensureMountedSetFromFitmentInternal(tenantSlug, vehicleId);
  }

  /** Caller must enforce access (e.g. work-order read for partner tyre-close). */
  async ensureMountedSetFromFitmentInternal(
    tenantSlug: string,
    vehicleId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.ensureMountedSetFromFitmentTx(tx, tenantSlug, vehicleId);
    });
  }

  private async ensureMountedSetFromFitmentTx(
    tx: Prisma.TransactionClient,
    tenantSlug: string,
    vehicleId: string,
  ): Promise<void> {
    const vehicle = await tx.vehicle.findFirst({
      where: { id: vehicleId, tenant: { slug: tenantSlug } },
      select: { id: true, tenantId: true, clientId: true },
    });
    if (!vehicle) return;

    const activeOnVehicle = await tx.tirePlacement.count({
      where: { vehicleId, kind: 'on_vehicle', validTo: null },
    });
    if (activeOnVehicle > 0) return;

    const existingSetCount = await tx.tireSet.count({ where: { vehicleId } });
    if (existingSetCount > 0) return;

    const linkedAssetPlacements = await tx.tirePlacement.count({
      where: {
        validTo: null,
        asset: {
          setItems: {
            some: { set: { vehicleId } },
          },
        },
      },
    });
    if (linkedAssetPlacements > 0) return;

    const fitments = await tx.vehicleWheelFitment.findMany({
      where: { vehicleId },
      orderBy: { position: 'asc' },
    });
    if (fitments.length === 0) return;

    const setSeason = pickSetSeason(fitments.map((f) => f.season));
    const tireSet = await tx.tireSet.create({
      data: {
        tenantId: vehicle.tenantId,
        clientId: vehicle.clientId,
        vehicleId,
        season: setSeason,
        name: MOUNTED_SET_NAME,
        mountedAs: 'on_rim',
      },
    });

    const now = new Date();
    for (const fitment of fitments) {
      const fields: FitmentSyncFields = {
        size: fitment.size,
        brand: fitment.brand,
        model: fitment.model,
        season: fitment.season,
        speedIndex: fitment.speedIndex,
        loadIndex: fitment.loadIndex,
        commercialC: fitment.commercialC,
        dot: fitment.dot,
        treadMm: fitment.treadMm,
        rimSize: fitment.rimSize,
        rimMaterial: fitment.rimMaterial,
        lugNutCount: fitment.lugNutCount,
      };

      const rimAssetId = await this.upsertRimFromFitmentTx(
        tx,
        vehicle.tenantId,
        vehicle.clientId,
        fields,
      );

      const asset = await tx.tireAsset.create({
        data: {
          tenantId: vehicle.tenantId,
          clientId: vehicle.clientId,
          ownerClientId: vehicle.clientId,
          ownershipType: 'client',
          provenance: 'inferred',
          rimAssetId: rimAssetId ?? undefined,
          ...this.stripUndefined(assetDataFromFitment(fields) as Record<string, unknown>),
        },
      });

      await tx.tireSetItem.create({
        data: {
          setId: tireSet.id,
          assetId: asset.id,
          sortOrder: positionSortIndex(fitment.position),
        },
      });

      await tx.tirePlacement.create({
        data: {
          tenantId: vehicle.tenantId,
          assetId: asset.id,
          kind: 'on_vehicle',
          vehicleId,
          position: fitment.position,
          setId: tireSet.id,
          validFrom: now,
        },
      });

      await tx.tireEvent.create({
        data: {
          tenantId: vehicle.tenantId,
          type: 'mount',
          assetId: asset.id,
          setId: tireSet.id,
          rimAssetId: rimAssetId,
          vehicleId,
          payload: { source: 'fitment_bootstrap', position: fitment.position },
        },
      });
    }
  }

  async createSet(
    tenantSlug: string,
    vehicleId: string,
    dto: CreateTireSetDto,
    access?: AccessContext,
  ): Promise<TireSetSummary> {
    await assertVehicleOpsWrite(this.prisma, tenantSlug, vehicleId, access);
    if (!CREATE_SET_SEASONS.includes(dto.season)) {
      throw new BadRequestException('season must be summer, winter, or all_season');
    }
    const mountedAs = dto.mountedAs ?? 'on_rim';
    if (mountedAs !== 'on_rim' && mountedAs !== 'tyre_only') {
      throw new BadRequestException('Invalid mountedAs');
    }
    const seedFrom = dto.seedFrom ?? 'mounted_specs';

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenant: { slug: tenantSlug } },
      select: { id: true, tenantId: true, clientId: true },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const name = dto.name?.trim() || null;

    if (seedFrom === 'empty') {
      const set = await this.prisma.tireSet.create({
        data: {
          tenantId: vehicle.tenantId,
          clientId: vehicle.clientId,
          vehicleId,
          season: dto.season,
          name,
          mountedAs,
        },
        include: { _count: { select: { items: true } } },
      });

      await this.prisma.tireEvent.create({
        data: {
          tenantId: vehicle.tenantId,
          type: 'store',
          setId: set.id,
          vehicleId,
          payload: { kind: 'at_client', season: dto.season, name, seedFrom: 'empty' },
        },
      });

      return {
        id: set.id,
        season: set.season,
        name: set.name,
        mountedAs: set.mountedAs,
        archivedAt: null,
        itemCount: set._count.items,
        isMounted: false,
      };
    }

    return this.prisma.$transaction(async (tx) => {
      const sources = await this.collectMountedSpecSourcesTx(tx, vehicleId);
      if (sources.length === 0) {
        throw new BadRequestException(
          'No mounted wheel specifications to copy for this vehicle (save fitment or mount tires first)',
        );
      }

      const set = await tx.tireSet.create({
        data: {
          tenantId: vehicle.tenantId,
          clientId: vehicle.clientId,
          vehicleId,
          season: dto.season,
          name,
          mountedAs,
        },
      });

      const assetIds: string[] = [];
      for (const src of sources) {
        let rimAssetId: string | null = null;
        if (mountedAs !== 'tyre_only') {
          rimAssetId = await this.cloneRimFromSourceTx(
            tx,
            vehicle.tenantId,
            vehicle.clientId,
            src,
          );
        }

        const asset = await tx.tireAsset.create({
          data: {
            tenantId: vehicle.tenantId,
            clientId: vehicle.clientId,
            ownerClientId: vehicle.clientId,
            ownershipType: 'client',
            provenance: 'inferred',
            rimAssetId: rimAssetId ?? undefined,
            size: src.size,
            brand: src.brand,
            model: src.model,
            season: dto.season,
            speedIndex: src.speedIndex,
            loadIndex: src.loadIndex,
            commercialC: src.commercialC,
          },
        });
        assetIds.push(asset.id);

        await tx.tireSetItem.create({
          data: {
            setId: set.id,
            assetId: asset.id,
            sortOrder: positionSortIndex(src.position),
          },
        });

        await this.placeAssetTx(tx, {
          tenantId: vehicle.tenantId,
          assetId: asset.id,
          kind: 'at_client',
          vehicleId,
          setId: set.id,
          eventType: 'store',
          vehicleIdForEvent: vehicleId,
          payload: {
            source: 'create_set_seed',
            seedFrom: 'mounted_specs',
            position: src.position,
            season: dto.season,
            name,
          },
        });
      }

      return {
        id: set.id,
        season: set.season,
        name: set.name,
        mountedAs: set.mountedAs,
        archivedAt: null,
        itemCount: assetIds.length,
        isMounted: false,
      };
    });
  }

  private async collectMountedSpecSourcesTx(
    tx: Prisma.TransactionClient,
    vehicleId: string,
  ): Promise<SeedSpecSource[]> {
    const placements = await tx.tirePlacement.findMany({
      where: { vehicleId, kind: 'on_vehicle', validTo: null },
      include: { asset: { include: { rimAsset: true } } },
    });

    if (placements.length > 0) {
      const sources: SeedSpecSource[] = [];
      for (const pl of placements) {
        if (!pl.position) continue;
        const a = pl.asset;
        const rim = a.rimAsset;
        const fields = {
          size: a.size,
          brand: a.brand,
          model: a.model,
        };
        if (!positionHasSpecData(fields)) continue;
        sources.push({
          position: pl.position,
          size: a.size,
          brand: a.brand,
          model: a.model,
          speedIndex: a.speedIndex,
          loadIndex: a.loadIndex,
          commercialC: a.commercialC,
          rimSize: rim?.size ?? null,
          rimMaterial: rim?.material ?? null,
          lugNutCount: rim?.lugNutCount ?? null,
        });
      }
      sources.sort((a, b) => positionSortIndex(a.position) - positionSortIndex(b.position));
      return sources;
    }

    const fitments = await tx.vehicleWheelFitment.findMany({
      where: { vehicleId },
    });
    const sources: SeedSpecSource[] = [];
    for (const f of fitments) {
      if (
        !positionHasSpecData({
          size: f.size,
          brand: f.brand,
          model: f.model,
        })
      ) {
        continue;
      }
      sources.push({
        position: f.position,
        size: f.size,
        brand: f.brand,
        model: f.model,
        speedIndex: f.speedIndex,
        loadIndex: f.loadIndex,
        commercialC: f.commercialC,
        rimSize: f.rimSize,
        rimMaterial: f.rimMaterial,
        lugNutCount: f.lugNutCount,
      });
    }
    sources.sort((a, b) => positionSortIndex(a.position) - positionSortIndex(b.position));
    return sources;
  }

  private async cloneRimFromSourceTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    clientId: string,
    source: Pick<SeedSpecSource, 'rimSize' | 'rimMaterial' | 'lugNutCount'>,
  ): Promise<string | null> {
    const fields: FitmentSyncFields = {
      rimSize: source.rimSize,
      rimMaterial: source.rimMaterial,
      lugNutCount: source.lugNutCount,
    };
    if (!hasRimFields(fields)) return null;

    const rim = await tx.rimAsset.create({
      data: {
        tenantId,
        clientId,
        ownerClientId: clientId,
        ownershipType: 'client',
        provenance: 'inferred',
        size: source.rimSize ?? null,
        material: source.rimMaterial ?? null,
        lugNutCount: source.lugNutCount ?? null,
      },
    });
    return rim.id;
  }

  async syncFromFitmentUpsert(
    tx: Prisma.TransactionClient,
    tenantId: string,
    vehicleId: string,
    clientId: string,
    position: VehicleWheelPosition,
    fields: FitmentSyncFields,
  ): Promise<void> {
    const activeAtPosition = await tx.tirePlacement.findFirst({
      where: {
        vehicleId,
        position,
        kind: 'on_vehicle',
        validTo: null,
      },
      include: { asset: true },
    });

    if (activeAtPosition) {
      const rimAssetId = await this.upsertRimFromFitmentTx(tx, tenantId, clientId, fields, {
        existingRimAssetId: activeAtPosition.asset.rimAssetId,
      });
      await tx.tireAsset.update({
        where: { id: activeAtPosition.assetId },
        data: {
          ...this.stripUndefined(assetDataFromFitment(fields) as Record<string, unknown>),
          rimAssetId: rimAssetId ?? activeAtPosition.asset.rimAssetId,
        },
      });
      return;
    }

    const mountedSetId = await this.getOrCreateMountedSetIdTx(tx, tenantId, vehicleId, clientId, fields.season);

    const rimAssetId = await this.upsertRimFromFitmentTx(tx, tenantId, clientId, fields);
    const asset = await tx.tireAsset.create({
      data: {
        tenantId,
        clientId,
        ownerClientId: clientId,
        ownershipType: 'client',
        provenance: 'inferred',
        rimAssetId: rimAssetId ?? undefined,
        ...this.stripUndefined(assetDataFromFitment(fields) as Record<string, unknown>),
      },
    });

    await tx.tireSetItem.upsert({
      where: { setId_assetId: { setId: mountedSetId, assetId: asset.id } },
      create: {
        setId: mountedSetId,
        assetId: asset.id,
        sortOrder: positionSortIndex(position),
      },
      update: { sortOrder: positionSortIndex(position) },
    });

    await this.placeAssetTx(tx, {
      tenantId,
      assetId: asset.id,
      kind: 'on_vehicle',
      vehicleId,
      position,
      setId: mountedSetId,
      eventType: 'mount',
      vehicleIdForEvent: vehicleId,
      payload: { source: 'fitment_sync', position },
    });
  }

  async syncAfterFitmentClear(
    tx: Prisma.TransactionClient,
    tenantId: string,
    vehicleId: string,
    position: VehicleWheelPosition,
  ): Promise<void> {
    const activeAtPosition = await tx.tirePlacement.findFirst({
      where: { vehicleId, position, kind: 'on_vehicle', validTo: null },
    });
    if (!activeAtPosition) return;

    const now = new Date();
    await tx.tirePlacement.update({
      where: { id: activeAtPosition.id },
      data: { validTo: now },
    });
    await tx.tireEvent.create({
      data: {
        tenantId,
        type: 'demount',
        assetId: activeAtPosition.assetId,
        setId: activeAtPosition.setId,
        vehicleId,
        payload: { source: 'fitment_clear', position },
      },
    });

    await this.placeAssetTx(tx, {
      tenantId,
      assetId: activeAtPosition.assetId,
      kind: 'at_client',
      setId: activeAtPosition.setId ?? undefined,
      eventType: 'store',
      vehicleIdForEvent: vehicleId,
      payload: { source: 'fitment_clear', position },
    });
  }

  async placeAsset(params: PlaceAssetParams): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.placeAssetTx(tx, params);
    });
  }

  async placeAssetTx(tx: Prisma.TransactionClient, params: PlaceAssetParams): Promise<void> {
    const now = new Date();
    const active = await tx.tirePlacement.findFirst({
      where: { assetId: params.assetId, validTo: null },
    });
    if (active) {
      await tx.tirePlacement.update({
        where: { id: active.id },
        data: { validTo: now },
      });
    }

    await tx.tirePlacement.create({
      data: {
        tenantId: params.tenantId,
        assetId: params.assetId,
        kind: params.kind,
        vehicleId: params.vehicleId ?? undefined,
        position: params.position ?? undefined,
        supplierId: params.supplierId ?? undefined,
        locationCode: params.locationCode ?? undefined,
        setId: params.setId ?? undefined,
        validFrom: now,
      },
    });

    const eventType: TireEventType =
      params.eventType ??
      (params.kind === 'on_vehicle' ? 'mount' : active ? 'transfer' : 'store');

    await tx.tireEvent.create({
      data: {
        tenantId: params.tenantId,
        type: eventType,
        assetId: params.assetId,
        setId: params.setId ?? undefined,
        vehicleId: params.vehicleIdForEvent ?? params.vehicleId ?? undefined,
        workOrderId: params.workOrderId ?? undefined,
        odometerKm: params.odometerKm ?? undefined,
        actorUserId: params.actorUserId ?? undefined,
        payload: params.payload ?? undefined,
      },
    });
  }

  /** Proiectează placements on_vehicle → VehicleWheelFitment (sursă temporală placements). */
  async syncFitmentProjectionTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    vehicleId: string,
  ): Promise<void> {
    const placements = await tx.tirePlacement.findMany({
      where: { vehicleId, kind: 'on_vehicle', validTo: null },
      include: { asset: { include: { rimAsset: true } } },
    });
    const activePositions = new Set(
      placements.map((p) => p.position).filter((p): p is VehicleWheelPosition => !!p),
    );

    for (const pl of placements) {
      if (!pl.position) continue;
      const a = pl.asset;
      const rim = a.rimAsset;
      await tx.vehicleWheelFitment.upsert({
        where: {
          vehicleId_position: { vehicleId, position: pl.position },
        },
        create: {
          tenantId,
          vehicleId,
          position: pl.position,
          size: a.size,
          brand: a.brand,
          model: a.model,
          season: a.season,
          speedIndex: a.speedIndex,
          loadIndex: a.loadIndex,
          commercialC: a.commercialC,
          dot: a.dot,
          treadMm: a.treadMm,
          rimSize: rim?.size ?? null,
          rimMaterial: rim?.material ?? null,
          lugNutCount: rim?.lugNutCount ?? null,
        },
        update: {
          size: a.size,
          brand: a.brand,
          model: a.model,
          season: a.season,
          speedIndex: a.speedIndex,
          loadIndex: a.loadIndex,
          commercialC: a.commercialC,
          dot: a.dot,
          treadMm: a.treadMm,
          rimSize: rim?.size ?? null,
          rimMaterial: rim?.material ?? null,
          lugNutCount: rim?.lugNutCount ?? null,
        },
      });
    }

    const fitments = await tx.vehicleWheelFitment.findMany({
      where: { vehicleId },
      select: { id: true, position: true },
    });
    for (const f of fitments) {
      if (!activePositions.has(f.position)) {
        await tx.vehicleWheelFitment.delete({ where: { id: f.id } });
      }
    }
  }

  private async getOrCreateMountedSetIdTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    vehicleId: string,
    clientId: string,
    seasonHint?: VehicleTireSeason,
  ): Promise<string> {
    const viaPlacement = await tx.tirePlacement.findFirst({
      where: { vehicleId, kind: 'on_vehicle', validTo: null, setId: { not: null } },
      select: { setId: true },
    });
    if (viaPlacement?.setId) return viaPlacement.setId;

    const named = await tx.tireSet.findFirst({
      where: { vehicleId, name: MOUNTED_SET_NAME, archivedAt: null },
      select: { id: true },
    });
    if (named) return named.id;

    const created = await tx.tireSet.create({
      data: {
        tenantId,
        clientId,
        vehicleId,
        season: seasonHint && seasonHint !== 'unknown' ? seasonHint : 'unknown',
        name: MOUNTED_SET_NAME,
        mountedAs: 'on_rim',
      },
    });
    return created.id;
  }

  private async upsertRimFromFitmentTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    clientId: string,
    fields: FitmentSyncFields,
    opts?: { existingRimAssetId?: string | null },
  ): Promise<string | null> {
    if (!hasRimFields(fields)) {
      return opts?.existingRimAssetId ?? null;
    }

    if (opts?.existingRimAssetId) {
      await tx.rimAsset.update({
        where: { id: opts.existingRimAssetId },
        data: {
          size: fields.rimSize ?? undefined,
          material: fields.rimMaterial ?? undefined,
          lugNutCount: fields.lugNutCount ?? undefined,
        },
      });
      return opts.existingRimAssetId;
    }

    const rim = await tx.rimAsset.create({
      data: {
        tenantId,
        clientId,
        ownerClientId: clientId,
        ownershipType: 'client',
        provenance: 'inferred',
        size: fields.rimSize ?? null,
        material: fields.rimMaterial ?? null,
        lugNutCount: fields.lugNutCount ?? null,
      },
    });
    return rim.id;
  }

  private stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
    const out: Partial<T> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) (out as Record<string, unknown>)[k] = v;
    }
    return out;
  }
}

export function assertCreateTireSetDto(body: unknown): CreateTireSetDto {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('Body must be an object');
  }
  const o = body as Record<string, unknown>;
  const season = o.season;
  if (typeof season !== 'string' || !CREATE_SET_SEASONS.includes(season as VehicleTireSeason)) {
    throw new BadRequestException('season required (summer|winter|all_season)');
  }
  const mountedAs =
    o.mountedAs === undefined
      ? undefined
      : o.mountedAs === 'on_rim' || o.mountedAs === 'tyre_only'
        ? (o.mountedAs as import('@prisma/client').TireMountedAs)
        : (() => {
            throw new BadRequestException('Invalid mountedAs');
          })();
  const seedFromRaw = o.seedFrom;
  const seedFrom =
    seedFromRaw === undefined
      ? ('mounted_specs' as const)
      : seedFromRaw === 'mounted_specs' || seedFromRaw === 'empty'
        ? seedFromRaw
        : (() => {
            throw new BadRequestException('seedFrom must be mounted_specs or empty');
          })();

  return {
    season: season as VehicleTireSeason,
    name: o.name === undefined ? undefined : o.name === null ? null : String(o.name),
    mountedAs,
    seedFrom,
  };
}
