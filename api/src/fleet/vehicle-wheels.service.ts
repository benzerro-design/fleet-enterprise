import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { VehicleRimMaterial, VehicleTireSeason, VehicleWheelPosition } from '@prisma/client';
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
  items: VehicleWheelFitmentRecord[];
};

const POSITIONS: VehicleWheelPosition[] = ['fl', 'fr', 'rl', 'rr', 'spare'];
const SEASONS: VehicleTireSeason[] = ['summer', 'winter', 'all_season', 'unknown'];
const RIM_MATERIALS: VehicleRimMaterial[] = ['steel', 'alloy', 'diamond_cut'];

function toRecord(row: {
  id: string;
  vehicleId: string;
  position: VehicleWheelPosition;
  size: string | null;
  brand: string | null;
  model: string | null;
  season: VehicleTireSeason;
  speedIndex: string | null;
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
      select: { id: true },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const rows = await this.prisma.vehicleWheelFitment.findMany({
      where: { vehicleId },
      orderBy: { position: 'asc' },
    });
    return { items: rows.map(toRecord) };
  }

  async upsert(
    tenantSlug: string,
    vehicleId: string,
    dto: UpsertWheelDto,
    access?: AccessContext,
  ): Promise<VehicleWheelFitmentRecord> {
    await assertVehicleOpsWrite(this.prisma, tenantSlug, vehicleId, access);
    if (!POSITIONS.includes(dto.position)) {
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
      select: { id: true, tenantId: true },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

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
      speedIndex: dto.speedIndex === undefined ? undefined : dto.speedIndex?.trim().toUpperCase() || null,
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
        season,
        ...(data.speedIndex !== undefined ? { speedIndex: data.speedIndex } : {}),
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

  async clearPosition(
    tenantSlug: string,
    vehicleId: string,
    position: VehicleWheelPosition,
    access?: AccessContext,
  ): Promise<void> {
    await assertVehicleOpsWrite(this.prisma, tenantSlug, vehicleId, access);
    if (!POSITIONS.includes(position)) {
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
  if (typeof position !== 'string' || !POSITIONS.includes(position as VehicleWheelPosition)) {
    throw new BadRequestException('position required (fl|fr|rl|rr|spare)');
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
        : typeof o.rimMaterial === 'string' && RIM_MATERIALS.includes(o.rimMaterial as VehicleRimMaterial)
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
