import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  VehicleRimMaterial,
  VehicleTireSeason,
  VehicleWheelLayout,
  VehicleWheelPosition,
} from '@prisma/client';
import type { AccessContext } from '../iam/access-context.types';
import { assertVehicleOpsRead, assertVehicleOpsWrite } from '../ops/ops-write-access';
import { PrismaService } from '../prisma/prisma.service';

export type VehicleWheelFitmentRecord = {
  id: string;
  vehicleId: string;
  position: VehicleWheelPosition;
  size: string | null;
  brand: string | null;
  model: string | null;
  season: VehicleTireSeason;
  speedIndex: string | null;
  loadIndex: string | null;
  commercialC: boolean;
  dot: string | null;
  treadMm: number | null;
  rimSize: string | null;
  rimMaterial: VehicleRimMaterial | null;
  lugNutCount: number | null;
  notes: string | null;
  updatedAt: string;
};

export type VehicleWheelsPayload = {
  wheelLayout: VehicleWheelLayout;
  items: VehicleWheelFitmentRecord[];
};

const ALL_POSITIONS: VehicleWheelPosition[] = [
  'fl',
  'fr',
  'rl',
  'rr',
  'spare',
  'rlo',
  'rli',
  'rro',
  'rri',
];

const LAYOUT_POSITIONS: Record<VehicleWheelLayout, VehicleWheelPosition[]> = {
  four: ['fl', 'fr', 'rl', 'rr', 'spare'],
  six_dual_rear: ['fl', 'fr', 'rlo', 'rli', 'rro', 'rri', 'spare'],
};

const POSITION_ORDER: VehicleWheelPosition[] = [
  'fl',
  'fr',
  'rl',
  'rr',
  'rlo',
  'rli',
  'rro',
  'rri',
  'spare',
];

const SEASONS: VehicleTireSeason[] = ['summer', 'winter', 'all_season', 'unknown'];
const RIM_MATERIALS: VehicleRimMaterial[] = ['steel', 'alloy', 'diamond_cut'];
const LAYOUTS: VehicleWheelLayout[] = ['four', 'six_dual_rear'];

function sortItems(items: VehicleWheelFitmentRecord[]): VehicleWheelFitmentRecord[] {
  const rank = new Map(POSITION_ORDER.map((p, i) => [p, i]));
  return [...items].sort((a, b) => (rank.get(a.position) ?? 99) - (rank.get(b.position) ?? 99));
}

function toRecord(row: {
  id: string;
  vehicleId: string;
  position: VehicleWheelPosition;
  size: string | null;
  brand: string | null;
  model: string | null;
  season: VehicleTireSeason;
  speedIndex: string | null;
  loadIndex: string | null;
  commercialC: boolean;
  dot: string | null;
  treadMm: number | null;
  rimSize: string | null;
  rimMaterial: VehicleRimMaterial | null;
  lugNutCount: number | null;
  notes: string | null;
  updatedAt: Date;
}): VehicleWheelFitmentRecord {
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    position: row.position,
    size: row.size,
    brand: row.brand,
    model: row.model,
    season: row.season,
    speedIndex: row.speedIndex,
    loadIndex: row.loadIndex,
    commercialC: row.commercialC,
    dot: row.dot,
    treadMm: row.treadMm,
    rimSize: row.rimSize,
    rimMaterial: row.rimMaterial,
    lugNutCount: row.lugNutCount,
    notes: row.notes,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type UpsertWheelDto = {
  position: VehicleWheelPosition;
  size?: string | null;
  brand?: string | null;
  model?: string | null;
  season?: VehicleTireSeason;
  speedIndex?: string | null;
  loadIndex?: string | null;
  commercialC?: boolean;
  dot?: string | null;
  treadMm?: number | null;
  rimSize?: string | null;
  rimMaterial?: VehicleRimMaterial | null;
  lugNutCount?: number | null;
  notes?: string | null;
};

@Injectable()
export class VehicleWheelsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    tenantSlug: string,
    vehicleId: string,
    access?: AccessContext,
  ): Promise<VehicleWheelsPayload> {
    await assertVehicleOpsRead(this.prisma, tenantSlug, vehicleId, access);
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenant: { slug: tenantSlug } },
      select: { id: true, wheelLayout: true },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const rows = await this.prisma.vehicleWheelFitment.findMany({
      where: { vehicleId },
    });
    return {
      wheelLayout: vehicle.wheelLayout,
      items: sortItems(rows.map(toRecord)),
    };
  }

  async setLayout(
    tenantSlug: string,
    vehicleId: string,
    layout: VehicleWheelLayout,
    access?: AccessContext,
  ): Promise<VehicleWheelsPayload> {
    await assertVehicleOpsWrite(this.prisma, tenantSlug, vehicleId, access);
    if (!LAYOUTS.includes(layout)) {
      throw new BadRequestException('Invalid wheelLayout');
    }

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenant: { slug: tenantSlug } },
      select: { id: true, tenantId: true, wheelLayout: true },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const prev = vehicle.wheelLayout;
    await this.prisma.$transaction(async (tx) => {
      await tx.vehicle.update({
        where: { id: vehicleId },
        data: { wheelLayout: layout },
      });

      // 4 → 6: copiază rl pe rlo+rli, rr pe rro+rri (PO: opțiunea A)
      if (prev === 'four' && layout === 'six_dual_rear') {
        const singles = await tx.vehicleWheelFitment.findMany({
          where: { vehicleId, position: { in: ['rl', 'rr'] } },
        });
        for (const row of singles) {
          const targets: VehicleWheelPosition[] =
            row.position === 'rl' ? ['rlo', 'rli'] : ['rro', 'rri'];
          for (const position of targets) {
            await tx.vehicleWheelFitment.upsert({
              where: { vehicleId_position: { vehicleId, position } },
              create: {
                tenantId: vehicle.tenantId,
                vehicleId,
                position,
                size: row.size,
                brand: row.brand,
                model: row.model,
                season: row.season,
                speedIndex: row.speedIndex,
                loadIndex: row.loadIndex,
                commercialC: row.commercialC,
                rimSize: row.rimSize,
                rimMaterial: row.rimMaterial,
                lugNutCount: row.lugNutCount,
                // DOT / uzură / note rămân pe poziția veche; duale fără identitate
                dot: null,
                treadMm: null,
                notes: null,
              },
              update: {
                size: row.size,
                brand: row.brand,
                model: row.model,
                season: row.season,
                speedIndex: row.speedIndex,
                loadIndex: row.loadIndex,
                commercialC: row.commercialC,
                rimSize: row.rimSize,
                rimMaterial: row.rimMaterial,
                lugNutCount: row.lugNutCount,
              },
            });
          }
        }
      }
    });

    return this.list(tenantSlug, vehicleId, access);
  }

  async upsert(
    tenantSlug: string,
    vehicleId: string,
    dto: UpsertWheelDto,
    access?: AccessContext,
  ): Promise<VehicleWheelFitmentRecord> {
    await assertVehicleOpsWrite(this.prisma, tenantSlug, vehicleId, access);
    if (!ALL_POSITIONS.includes(dto.position)) {
      throw new BadRequestException('Invalid wheel position');
    }
    const season = dto.season ?? 'unknown';
    if (!SEASONS.includes(season)) {
      throw new BadRequestException('Invalid tire season');
    }
    if (
      dto.rimMaterial !== undefined &&
      dto.rimMaterial !== null &&
      !RIM_MATERIALS.includes(dto.rimMaterial)
    ) {
      throw new BadRequestException('Invalid rim material');
    }

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenant: { slug: tenantSlug } },
      select: { id: true, tenantId: true, wheelLayout: true },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const allowed = LAYOUT_POSITIONS[vehicle.wheelLayout];
    if (!allowed.includes(dto.position)) {
      throw new BadRequestException(
        `Position ${dto.position} not allowed for layout ${vehicle.wheelLayout}`,
      );
    }

    const treadMm =
      dto.treadMm === undefined || dto.treadMm === null
        ? dto.treadMm === null
          ? null
          : undefined
        : Number.isFinite(dto.treadMm) && dto.treadMm >= 0
          ? dto.treadMm
          : (() => {
              throw new BadRequestException('treadMm must be a non-negative number');
            })();

    const lugNutCount =
      dto.lugNutCount === undefined || dto.lugNutCount === null
        ? dto.lugNutCount === null
          ? null
          : undefined
        : Number.isInteger(dto.lugNutCount) && dto.lugNutCount > 0 && dto.lugNutCount <= 20
          ? dto.lugNutCount
          : (() => {
              throw new BadRequestException('lugNutCount must be an integer 1–20');
            })();

    const data = {
      size: dto.size === undefined ? undefined : dto.size?.trim() || null,
      brand: dto.brand === undefined ? undefined : dto.brand?.trim() || null,
      model: dto.model === undefined ? undefined : dto.model?.trim() || null,
      season,
      speedIndex:
        dto.speedIndex === undefined ? undefined : dto.speedIndex?.trim().toUpperCase() || null,
      loadIndex: dto.loadIndex === undefined ? undefined : dto.loadIndex?.trim() || null,
      commercialC: dto.commercialC === undefined ? undefined : Boolean(dto.commercialC),
      dot: dto.dot === undefined ? undefined : dto.dot?.trim() || null,
      treadMm: treadMm === undefined ? undefined : treadMm,
      rimSize: dto.rimSize === undefined ? undefined : dto.rimSize?.trim() || null,
      rimMaterial: dto.rimMaterial === undefined ? undefined : dto.rimMaterial,
      lugNutCount: lugNutCount === undefined ? undefined : lugNutCount,
      notes: dto.notes === undefined ? undefined : dto.notes?.trim() || null,
    };

    const row = await this.prisma.vehicleWheelFitment.upsert({
      where: { vehicleId_position: { vehicleId, position: dto.position } },
      create: {
        tenantId: vehicle.tenantId,
        vehicleId,
        position: dto.position,
        size: data.size ?? null,
        brand: data.brand ?? null,
        model: data.model ?? null,
        season,
        speedIndex: data.speedIndex ?? null,
        loadIndex: data.loadIndex ?? null,
        commercialC: data.commercialC ?? false,
        dot: data.dot ?? null,
        treadMm: treadMm === undefined ? null : treadMm,
        rimSize: data.rimSize ?? null,
        rimMaterial: data.rimMaterial ?? null,
        lugNutCount: lugNutCount === undefined ? null : lugNutCount,
        notes: data.notes ?? null,
      },
      update: {
        ...(data.size !== undefined ? { size: data.size } : {}),
        ...(data.brand !== undefined ? { brand: data.brand } : {}),
        ...(data.model !== undefined ? { model: data.model } : {}),
        ...(dto.season !== undefined ? { season } : {}),
        ...(data.speedIndex !== undefined ? { speedIndex: data.speedIndex } : {}),
        ...(data.loadIndex !== undefined ? { loadIndex: data.loadIndex } : {}),
        ...(data.commercialC !== undefined ? { commercialC: data.commercialC } : {}),
        ...(data.dot !== undefined ? { dot: data.dot } : {}),
        ...(treadMm !== undefined ? { treadMm } : {}),
        ...(data.rimSize !== undefined ? { rimSize: data.rimSize } : {}),
        ...(data.rimMaterial !== undefined ? { rimMaterial: data.rimMaterial } : {}),
        ...(lugNutCount !== undefined ? { lugNutCount } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
    });

    return toRecord(row);
  }

  async upsertMany(
    tenantSlug: string,
    vehicleId: string,
    items: UpsertWheelDto[],
    access?: AccessContext,
  ): Promise<VehicleWheelsPayload> {
    for (const dto of items) {
      await this.upsert(tenantSlug, vehicleId, dto, access);
    }
    return this.list(tenantSlug, vehicleId, access);
  }

  async clearPosition(
    tenantSlug: string,
    vehicleId: string,
    position: VehicleWheelPosition,
    access?: AccessContext,
  ): Promise<void> {
    await assertVehicleOpsWrite(this.prisma, tenantSlug, vehicleId, access);
    if (!ALL_POSITIONS.includes(position)) {
      throw new BadRequestException('Invalid wheel position');
    }
    await this.prisma.vehicleWheelFitment.deleteMany({
      where: { vehicleId, position, vehicle: { tenant: { slug: tenantSlug } } },
    });
  }
}

export function assertUpsertWheelDto(body: unknown): UpsertWheelDto {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('Body must be an object');
  }
  const o = body as Record<string, unknown>;
  const position = o.position;
  if (typeof position !== 'string' || !ALL_POSITIONS.includes(position as VehicleWheelPosition)) {
    throw new BadRequestException('position required (fl|fr|rl|rr|spare|rlo|rli|rro|rri)');
  }
  const season =
    o.season === undefined
      ? undefined
      : typeof o.season === 'string' && SEASONS.includes(o.season as VehicleTireSeason)
        ? (o.season as VehicleTireSeason)
        : (() => {
            throw new BadRequestException('Invalid season');
          })();
  const rimMaterial =
    o.rimMaterial === undefined
      ? undefined
      : o.rimMaterial === null
        ? null
        : typeof o.rimMaterial === 'string' &&
            RIM_MATERIALS.includes(o.rimMaterial as VehicleRimMaterial)
          ? (o.rimMaterial as VehicleRimMaterial)
          : (() => {
              throw new BadRequestException('Invalid rimMaterial (steel|alloy|diamond_cut)');
            })();
  return {
    position: position as VehicleWheelPosition,
    size: o.size === undefined ? undefined : o.size === null ? null : String(o.size),
    brand: o.brand === undefined ? undefined : o.brand === null ? null : String(o.brand),
    model: o.model === undefined ? undefined : o.model === null ? null : String(o.model),
    season,
    speedIndex:
      o.speedIndex === undefined ? undefined : o.speedIndex === null ? null : String(o.speedIndex),
    loadIndex:
      o.loadIndex === undefined ? undefined : o.loadIndex === null ? null : String(o.loadIndex),
    commercialC:
      o.commercialC === undefined
        ? undefined
        : o.commercialC === true || o.commercialC === 'true' || o.commercialC === 1,
    dot: o.dot === undefined ? undefined : o.dot === null ? null : String(o.dot),
    treadMm:
      o.treadMm === undefined
        ? undefined
        : o.treadMm === null
          ? null
          : typeof o.treadMm === 'number'
            ? o.treadMm
            : Number(o.treadMm),
    rimSize: o.rimSize === undefined ? undefined : o.rimSize === null ? null : String(o.rimSize),
    rimMaterial,
    lugNutCount:
      o.lugNutCount === undefined
        ? undefined
        : o.lugNutCount === null
          ? null
          : typeof o.lugNutCount === 'number'
            ? o.lugNutCount
            : Number(o.lugNutCount),
    notes: o.notes === undefined ? undefined : o.notes === null ? null : String(o.notes),
  };
}

export function assertWheelLayout(body: unknown): VehicleWheelLayout {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('Body must be an object');
  }
  const layout = (body as Record<string, unknown>).wheelLayout;
  if (typeof layout !== 'string' || !LAYOUTS.includes(layout as VehicleWheelLayout)) {
    throw new BadRequestException('wheelLayout required (four|six_dual_rear)');
  }
  return layout as VehicleWheelLayout;
}

export function assertUpsertWheelBulkDto(body: unknown): UpsertWheelDto[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('Body must be an object');
  }
  const items = (body as Record<string, unknown>).items;
  if (!Array.isArray(items) || items.length === 0) {
    throw new BadRequestException('items required (non-empty array)');
  }
  if (items.length > 12) {
    throw new BadRequestException('Too many items');
  }
  return items.map(assertUpsertWheelDto);
}

export { LAYOUT_POSITIONS };
