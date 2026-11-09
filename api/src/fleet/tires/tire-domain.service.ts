import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  type TireEventType,
  type TirePlacementKind,
  type VehicleRimMaterial,
  type VehicleTireSeason,
  type VehicleWheelPosition,
} from '@prisma/client';
import type { AccessContext } from '../../iam/access-context.types';
import { assertVehicleOpsRead, assertVehicleOpsWrite } from '../../ops/ops-write-access';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateTireSetDto,
  FitmentSyncFields,
  PlaceAssetParams,
  TireSetItemPreview,
  TireSetLocation,
  TireSetSummary,
} from './tire-domain.types';
import { pickSetSeason, tireSetQrPayload } from './tire-domain.types';
import { positionSortIndex } from './tire-domain.types';

type Db = PrismaService | Prisma.TransactionClient;

const MOUNTED_SET_NAME = 'Montat';
const CREATE_SET_SEASONS: VehicleTireSeason[] = ['summer', 'winter', 'all_season'];
type SeedSpecSource = {
  position: VehicleWheelPosition;
  size: string | null;
  brand: string | null;
  model: string | null;
  season: VehicleTireSeason;
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

/** Seed opposite-season spare sets with size/rim only — avoid cloning summer brands into a winter set. */
function seedBrandModelForSeason(
  source: Pick<SeedSpecSource, 'brand' | 'model' | 'season'>,
  targetSeason: VehicleTireSeason,
): { brand: string | null; model: string | null } {
  const srcSeason = source.season;
  if (
    srcSeason !== 'unknown' &&
    targetSeason !== 'unknown' &&
    srcSeason !== targetSeason
  ) {
    return { brand: null, model: null };
  }
  return { brand: source.brand, model: source.model };
}

function dominantString(values: Array<string | null | undefined>): string | null {
  const cleaned = values.map((v) => v?.trim()).filter((v): v is string => !!v);
  if (cleaned.length === 0) return null;
  const first = cleaned[0]!;
  return cleaned.every((v) => v.toLocaleLowerCase('ro') === first.toLocaleLowerCase('ro'))
    ? first
    : null;
}

function normalizeIntakePhotoUrls(value: Prisma.JsonValue | null | undefined): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((url) => url.trim())
      .filter(Boolean);
  }
  return [];
}

function seasonLabelRo(season: VehicleTireSeason): string {
  if (season === 'summer') return 'Vară';
  if (season === 'winter') return 'Iarnă';
  if (season === 'all_season') return 'All-season';
  return 'Necunoscut';
}

function isSeasonOnlyName(name: string | null | undefined, season: VehicleTireSeason): boolean {
  const n = (name ?? '').trim().toLocaleLowerCase('ro');
  if (!n) return true;
  if (n === 'montat') return false;
  const labels = ['vară', 'vara', 'iarnă', 'iarna', 'all-season', 'all season', 'necunoscut'];
  return labels.includes(n) || n === seasonLabelRo(season).toLocaleLowerCase('ro');
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
      select: { id: true, registrationNumber: true },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    const plate = vehicle.registrationNumber ?? '';

    const sets = await this.prisma.tireSet.findMany({
      where: { vehicleId, archivedAt: null },
      orderBy: [{ createdAt: 'asc' }],
      include: {
        _count: { select: { items: true } },
        items: {
          orderBy: [{ sortOrder: 'asc' }, { assetId: 'asc' }],
          select: {
            asset: {
              select: {
                id: true,
                brand: true,
                model: true,
                size: true,
                season: true,
                treadMm: true,
                dot: true,
              },
            },
          },
        },
        placements: {
          where: { validTo: null },
          select: { id: true, kind: true, position: true, assetId: true },
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
      const onVehicle = s.placements.some((p) => p.kind === 'on_vehicle');
      const atHotel = Boolean(stay || pl);
      const atClient = s.placements.some((p) => p.kind === 'at_client');
      let location: TireSetLocation = 'other';
      if (onVehicle) location = 'on_vehicle';
      else if (atHotel) location = 'at_supplier_hotel';
      else if (atClient) location = 'at_client';
      else location = 'other';

      const hotel =
        atHotel
          ? {
              atSupplierHotel: true,
              supplierName: stay?.supplier.legalName ?? pl?.supplier?.legalName ?? null,
              locationCode: stay?.locationCode ?? pl?.locationCode ?? null,
              checkInAt: stay?.checkInAt.toISOString() ?? pl?.validFrom.toISOString() ?? null,
              stayId: stay?.id ?? null,
            }
          : null;
      const itemsSeason = pickSetSeason(s.items.map((i) => i.asset.season));
      const seasonMismatch =
        itemsSeason !== 'unknown' && s.season !== 'unknown' && itemsSeason !== s.season;
      const photoUrls = normalizeIntakePhotoUrls(stay?.intakePhotos ?? null);
      const positionByAsset = new Map(
        s.placements
          .filter((p) => p.kind === 'on_vehicle' && p.position)
          .map((p) => [p.assetId, p.position] as const),
      );
      const items: TireSetItemPreview[] = s.items.map((i) => ({
        assetId: i.asset.id,
        position: positionByAsset.get(i.asset.id) ?? null,
        brand: i.asset.brand,
        model: i.asset.model,
        size: i.asset.size,
        season: i.asset.season,
        treadMm: i.asset.treadMm,
        dot: i.asset.dot,
      }));

      return {
        id: s.id,
        season: s.season,
        name: s.name,
        mountedAs: s.mountedAs,
        archivedAt: s.archivedAt ? s.archivedAt.toISOString() : null,
        itemCount: s._count.items,
        isMounted: onVehicle,
        location,
        hotel,
        qrPayload: tireSetQrPayload(s.id),
        itemsSeason,
        seasonMismatch,
        dominantBrand: dominantString(s.items.map((i) => i.asset.brand)),
        dominantModel: dominantString(s.items.map((i) => i.asset.model)),
        dominantSize: dominantString(s.items.map((i) => i.asset.size)),
        photoUrls,
        photoCount: photoUrls.length,
        hrefInventar: `/fleet/tires?tab=inventar&vehicleId=${encodeURIComponent(vehicleId)}&setId=${encodeURIComponent(s.id)}`,
        hrefSeasonTicket: `/fleet/tickets/new?vehicleId=${encodeURIComponent(vehicleId)}&subject=${encodeURIComponent(`Schimb sezon anvelope ${plate}`)}`,
        hrefHotelTicket: `/fleet/tickets/new?vehicleId=${encodeURIComponent(vehicleId)}&subject=${encodeURIComponent(`Hotel anvelope ${plate} · ${seasonLabelRo(s.season)}`)}`,
        items,
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

      const rows = await this.listSetsForVehicleInternal(tenantSlug, vehicleId);
      const row = rows.find((r) => r.id === set.id);
      if (!row) throw new NotFoundException('Tire set not found after create');
      return row;
    }

    const createdId = await this.prisma.$transaction(async (tx) => {
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

        const brandModel = seedBrandModelForSeason(src, dto.season);
        const asset = await tx.tireAsset.create({
          data: {
            tenantId: vehicle.tenantId,
            clientId: vehicle.clientId,
            ownerClientId: vehicle.clientId,
            ownershipType: 'client',
            provenance: 'inferred',
            rimAssetId: rimAssetId ?? undefined,
            size: src.size,
            brand: brandModel.brand,
            model: brandModel.model,
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

      return set.id;
    });

    const rows = await this.listSetsForVehicleInternal(tenantSlug, vehicleId);
    const row = rows.find((r) => r.id === createdId);
    if (!row) throw new NotFoundException('Tire set not found after create');
    return row;
  }

  /**
   * Casare / arhivare set de depozit — nu pe set montat, nu cu sejur hotel deschis.
   * Assets → placement scrap + TireEvent scrap; set.archivedAt.
   */
  async scrapSet(
    tenantSlug: string,
    setId: string,
    access?: AccessContext,
    actorUserId?: string,
    opts?: { reason?: string | null; odometerKm?: number | null },
  ): Promise<{ id: string; archivedAt: string }> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const set = await this.prisma.tireSet.findFirst({
      where: { id: setId, tenantId: tenant.id, archivedAt: null },
      include: {
        items: { select: { assetId: true } },
        storageStays: { where: { checkOutAt: null }, select: { id: true }, take: 1 },
        placements: {
          where: { validTo: null, kind: 'on_vehicle' },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!set) throw new NotFoundException('Tire set not found');

    await assertVehicleOpsWrite(this.prisma, tenantSlug, set.vehicleId, access);

    if (set.placements.length > 0) {
      throw new BadRequestException(
        'Cannot scrap a mounted set — demount / seasonal swap first',
      );
    }
    if (set.storageStays.length > 0) {
      throw new BadRequestException(
        'Cannot scrap a set with an open hotel stay — check out first',
      );
    }

    const reason = opts?.reason?.trim() || null;
    const odometerKm =
      opts?.odometerKm != null && Number.isFinite(opts.odometerKm)
        ? Math.round(opts.odometerKm)
        : null;

    const archivedAt = await this.prisma.$transaction(async (tx) => {
      for (const item of set.items) {
        await this.placeAssetTx(tx, {
          tenantId: tenant.id,
          assetId: item.assetId,
          kind: 'scrap',
          setId: set.id,
          eventType: 'scrap',
          vehicleIdForEvent: set.vehicleId,
          actorUserId: actorUserId ?? undefined,
          odometerKm: odometerKm ?? undefined,
          payload: {
            source: 'tire_set_scrap',
            setId: set.id,
            reason,
          },
        });
      }

      await tx.tireEvent.create({
        data: {
          tenantId: tenant.id,
          type: 'scrap',
          setId: set.id,
          vehicleId: set.vehicleId,
          odometerKm: odometerKm ?? undefined,
          actorUserId: actorUserId ?? undefined,
          payload: { source: 'tire_set_scrap', reason, itemCount: set.items.length },
        },
      });

      const updated = await tx.tireSet.update({
        where: { id: set.id },
        data: { archivedAt: new Date() },
        select: { archivedAt: true },
      });
      return updated.archivedAt!;
    });

    return { id: set.id, archivedAt: archivedAt.toISOString() };
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
          season: a.season,
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
        season: f.season,
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
      if (activeAtPosition.setId) {
        await this.reconcileTireSetSeasonFromItemsTx(tx, activeAtPosition.setId);
      }
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
    await this.reconcileTireSetSeasonFromItemsTx(tx, mountedSetId);
  }

  /**
   * Keep TireSet.season aligned with its tire assets (fitment edits used to update only assets).
   */
  async reconcileTireSetSeasonFromItemsTx(
    tx: Prisma.TransactionClient,
    setId: string,
  ): Promise<VehicleTireSeason | null> {
    const set = await tx.tireSet.findUnique({
      where: { id: setId },
      select: { id: true, season: true },
    });
    if (!set) return null;

    const items = await tx.tireSetItem.findMany({
      where: { setId },
      select: { asset: { select: { season: true } } },
    });
    if (items.length === 0) return set.season;

    const next = pickSetSeason(items.map((i) => i.asset.season));
    if (next !== 'unknown' && next !== set.season) {
      await tx.tireSet.update({ where: { id: setId }, data: { season: next } });
      return next;
    }
    return set.season;
  }

  /** Align all non-archived sets on a vehicle: set.season ← majority of asset seasons. */
  async reconcileVehicleSetSeasons(
    tenantSlug: string,
    vehicleId: string,
    access?: AccessContext,
  ): Promise<TireSetSummary[]> {
    await assertVehicleOpsWrite(this.prisma, tenantSlug, vehicleId, access);
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenant: { slug: tenantSlug } },
      select: { id: true },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    await this.prisma.$transaction(async (tx) => {
      const sets = await tx.tireSet.findMany({
        where: { vehicleId, archivedAt: null },
        select: { id: true },
      });
      for (const s of sets) {
        await this.reconcileTireSetSeasonFromItemsTx(tx, s.id);
      }
    });

    return this.listSetsForVehicleInternal(tenantSlug, vehicleId);
  }

  /**
   * Correct set season (and optionally stamp all assets in the set).
   * Use when brands are right but set/asset seasons were swapped (e.g. Dunlop summer labeled winter).
   */
  async patchSetSeason(
    tenantSlug: string,
    setId: string,
    season: VehicleTireSeason,
    opts?: { propagateToAssets?: boolean },
    access?: AccessContext,
  ): Promise<TireSetSummary> {
    if (!CREATE_SET_SEASONS.includes(season)) {
      throw new BadRequestException('season must be summer, winter, or all_season');
    }
    const set = await this.prisma.tireSet.findFirst({
      where: { id: setId, archivedAt: null, vehicle: { tenant: { slug: tenantSlug } } },
      select: { id: true, vehicleId: true, name: true, season: true },
    });
    if (!set) throw new NotFoundException('Tire set not found');
    await assertVehicleOpsWrite(this.prisma, tenantSlug, set.vehicleId, access);

    const propagate = opts?.propagateToAssets !== false;
    const nextName = isSeasonOnlyName(set.name, set.season) ? null : set.name;

    await this.prisma.$transaction(async (tx) => {
      await tx.tireSet.update({
        where: { id: setId },
        data: { season, ...(nextName !== set.name ? { name: nextName } : {}) },
      });
      if (propagate) {
        await this.applySeasonToSetAssetsAndFitmentsTx(tx, setId, season);
      }
    });

    const rows = await this.listSetsForVehicleInternal(tenantSlug, set.vehicleId);
    const row = rows.find((r) => r.id === setId);
    if (!row) throw new NotFoundException('Tire set not found after update');
    return row;
  }

  private async applySeasonToSetAssetsAndFitmentsTx(
    tx: Prisma.TransactionClient,
    setId: string,
    season: VehicleTireSeason,
  ): Promise<void> {
    const items = await tx.tireSetItem.findMany({
      where: { setId },
      select: { assetId: true },
    });
    if (!items.length) return;
    await tx.tireAsset.updateMany({
      where: { id: { in: items.map((i) => i.assetId) } },
      data: { season },
    });
    const placements = await tx.tirePlacement.findMany({
      where: {
        setId,
        kind: 'on_vehicle',
        validTo: null,
        position: { not: null },
      },
      select: { position: true, vehicleId: true },
    });
    for (const pl of placements) {
      if (!pl.position || !pl.vehicleId) continue;
      await tx.vehicleWheelFitment.updateMany({
        where: { vehicleId: pl.vehicleId, position: pl.position },
        data: { season },
      });
    }
  }

  /**
   * Atomic season swap between two active sets on a vehicle (reclasificare, nu montaj fizic).
   * Body may omit set ids — uses the only two active sets.
   */
  async swapSetSeasons(
    tenantSlug: string,
    vehicleId: string,
    opts?: { setIdA?: string; setIdB?: string; winterSetId?: string },
    access?: AccessContext,
  ): Promise<TireSetSummary[]> {
    await assertVehicleOpsWrite(this.prisma, tenantSlug, vehicleId, access);
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenant: { slug: tenantSlug } },
      select: { id: true },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    await this.prisma.$transaction(async (tx) => {
      const sets = await tx.tireSet.findMany({
        where: { vehicleId, archivedAt: null },
        select: { id: true, season: true, name: true },
        orderBy: { createdAt: 'asc' },
      });
      if (sets.length !== 2) {
        throw new BadRequestException('Inversează sezoanele necesită exact 2 seturi active');
      }

      let a = sets[0]!;
      let b = sets[1]!;
      if (opts?.setIdA && opts?.setIdB) {
        if (opts.setIdA === opts.setIdB) {
          throw new BadRequestException('setIdA and setIdB must be different');
        }
        const foundA = sets.find((s) => s.id === opts.setIdA);
        const foundB = sets.find((s) => s.id === opts.setIdB);
        if (!foundA || !foundB) {
          throw new BadRequestException('setIdA/setIdB must be the two active sets');
        }
        a = foundA;
        b = foundB;
      }

      let seasonA: VehicleTireSeason;
      let seasonB: VehicleTireSeason;

      const pairIsSummerWinter =
        (a.season === 'summer' && b.season === 'winter') ||
        (a.season === 'winter' && b.season === 'summer');
      const pairSameSummerOrWinter =
        a.season === b.season && (a.season === 'summer' || a.season === 'winter');

      if (opts?.winterSetId) {
        if (!pairSameSummerOrWinter && !pairIsSummerWinter) {
          throw new BadRequestException(
            'Inversează sezoanele suportă Vară↔Iarnă. Editează sezoanele pe card dacă e all-season.',
          );
        }
        if (opts.winterSetId !== a.id && opts.winterSetId !== b.id) {
          throw new BadRequestException('winterSetId must be one of the two active sets');
        }
        seasonA = opts.winterSetId === a.id ? 'winter' : 'summer';
        seasonB = opts.winterSetId === b.id ? 'winter' : 'summer';
      } else if (pairIsSummerWinter) {
        seasonA = a.season === 'summer' ? 'winter' : 'summer';
        seasonB = b.season === 'summer' ? 'winter' : 'summer';
      } else if (pairSameSummerOrWinter) {
        throw new BadRequestException(
          'Ambele seturi au același sezon — trimite winterSetId (care set e de iarnă)',
        );
      } else {
        throw new BadRequestException(
          'Inversează sezoanele suportă Vară↔Iarnă. Editează sezoanele pe card dacă e all-season.',
        );
      }

      for (const row of [
        { set: a, season: seasonA },
        { set: b, season: seasonB },
      ]) {
        const nextName = isSeasonOnlyName(row.set.name, row.set.season) ? null : row.set.name;
        await tx.tireSet.update({
          where: { id: row.set.id },
          data: { season: row.season, name: nextName },
        });
        await this.applySeasonToSetAssetsAndFitmentsTx(tx, row.set.id, row.season);
      }
    });

    return this.listSetsForVehicleInternal(tenantSlug, vehicleId);
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

  /** Brand / model (și opțional size, DOT, uzură) pe o anvelopă din set. */
  async patchTireAssetSpecs(
    tenantSlug: string,
    assetId: string,
    body: {
      brand?: string | null;
      model?: string | null;
      size?: string | null;
      dot?: string | null;
      treadMm?: number | null;
    },
    access?: AccessContext,
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const asset = await this.prisma.tireAsset.findFirst({
      where: { id: assetId, tenantId: tenant.id },
      select: {
        id: true,
        setItems: { select: { setId: true, set: { select: { vehicleId: true } } }, take: 1 },
        placements: {
          where: { validTo: null, vehicleId: { not: null } },
          select: { vehicleId: true },
          take: 1,
        },
      },
    });
    if (!asset) throw new NotFoundException('Tire asset not found');
    const vehicleId =
      asset.placements[0]?.vehicleId ?? asset.setItems[0]?.set.vehicleId ?? null;
    if (vehicleId) {
      await assertVehicleOpsWrite(this.prisma, tenantSlug, vehicleId, access);
    } else if (access && !access.isTenantWide) {
      throw new ForbiddenException('Tire asset not accessible');
    }

    const data: Prisma.TireAssetUpdateInput = {};
    if ('brand' in body) {
      data.brand =
        body.brand === null || body.brand === undefined
          ? null
          : String(body.brand).trim() || null;
    }
    if ('model' in body) {
      data.model =
        body.model === null || body.model === undefined
          ? null
          : String(body.model).trim() || null;
    }
    if ('size' in body) {
      data.size =
        body.size === null || body.size === undefined
          ? null
          : String(body.size).trim() || null;
    }
    if ('dot' in body) {
      data.dot =
        body.dot === null || body.dot === undefined
          ? null
          : String(body.dot).trim() || null;
    }
    if ('treadMm' in body) {
      if (body.treadMm === null || body.treadMm === undefined) {
        data.treadMm = null;
      } else if (!Number.isFinite(body.treadMm) || body.treadMm < 0) {
        throw new BadRequestException('treadMm must be a non-negative number');
      } else {
        data.treadMm = body.treadMm;
      }
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No identity fields to patch');
    }

    const updated = await this.prisma.tireAsset.update({
      where: { id: assetId },
      data,
      select: {
        id: true,
        brand: true,
        model: true,
        size: true,
        dot: true,
        treadMm: true,
      },
    });
    return updated;
  }

  async patchTireAssetDocs(
    tenantSlug: string,
    assetId: string,
    body: { warrantyCertificateUrl?: string | null; purchaseDocs?: Prisma.InputJsonValue | null },
    access?: AccessContext,
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const asset = await this.prisma.tireAsset.findFirst({
      where: { id: assetId, tenantId: tenant.id },
      select: {
        id: true,
        setItems: { select: { set: { select: { vehicleId: true } } }, take: 1 },
        placements: { where: { validTo: null, vehicleId: { not: null } }, select: { vehicleId: true }, take: 1 },
      },
    });
    if (!asset) throw new NotFoundException('Tire asset not found');
    const vehicleId =
      asset.placements[0]?.vehicleId ?? asset.setItems[0]?.set.vehicleId ?? null;
    if (vehicleId) {
      await assertVehicleOpsWrite(this.prisma, tenantSlug, vehicleId, access);
    }
    const data: Prisma.TireAssetUpdateInput = {};
    if ('warrantyCertificateUrl' in body) {
      const raw = body.warrantyCertificateUrl;
      data.warrantyCertificateUrl =
        raw === null || raw === undefined ? null : String(raw).trim() || null;
    }
    if ('purchaseDocs' in body) {
      data.purchaseDocs =
        body.purchaseDocs === undefined
          ? undefined
          : body.purchaseDocs === null
            ? Prisma.JsonNull
            : body.purchaseDocs;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No document fields to patch');
    }
    return this.prisma.tireAsset.update({
      where: { id: assetId },
      data,
      select: {
        id: true,
        warrantyCertificateUrl: true,
        purchaseDocs: true,
      },
    });
  }

  async patchTireSetDocs(
    tenantSlug: string,
    setId: string,
    body: { warrantyCertificateUrl?: string | null; purchaseDocs?: Prisma.InputJsonValue | null },
    access?: AccessContext,
  ) {
    const set = await this.prisma.tireSet.findFirst({
      where: { id: setId, vehicle: { tenant: { slug: tenantSlug } } },
      select: { id: true, vehicleId: true },
    });
    if (!set) throw new NotFoundException('Tire set not found');
    await assertVehicleOpsWrite(this.prisma, tenantSlug, set.vehicleId, access);
    const data: Prisma.TireSetUpdateInput = {};
    if ('warrantyCertificateUrl' in body) {
      const raw = body.warrantyCertificateUrl;
      data.warrantyCertificateUrl =
        raw === null || raw === undefined ? null : String(raw).trim() || null;
    }
    if ('purchaseDocs' in body) {
      data.purchaseDocs =
        body.purchaseDocs === undefined
          ? undefined
          : body.purchaseDocs === null
            ? Prisma.JsonNull
            : body.purchaseDocs;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No document fields to patch');
    }
    return this.prisma.tireSet.update({
      where: { id: setId },
      data,
      select: {
        id: true,
        warrantyCertificateUrl: true,
        purchaseDocs: true,
      },
    });
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
