import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { VehicleTireSeason, VehicleWheelPosition } from '@prisma/client';
import type { AccessContext } from '../iam/access-context.types';
import { assertVehicleOpsRead, assertVehicleOpsWrite } from '../ops/ops-write-access';
import { PrismaService } from '../prisma/prisma.service';

export type VehicleWheelFitmentRecord = {
  id: string;
  vehicleId: string;
  position: VehicleWheelPosition;
  size: string | null;
  brand: string | null;
  season: VehicleTireSeason;
  dot: string | null;
  treadMm: number | null;
  rimSize: string | null;
  notes: string | null;
  updatedAt: string;
};

export type VehicleWheelsPayload = {
  items: VehicleWheelFitmentRecord[];
};

const POSITIONS: VehicleWheelPosition[] = ['fl', 'fr', 'rl', 'rr', 'spare'];
const SEASONS: VehicleTireSeason[] = ['summer', 'winter', 'all_season', 'unknown'];

function toRecord(row: {
  id: string;
  vehicleId: string;
  position: VehicleWheelPosition;
  size: string | null;
  brand: string | null;
  season: VehicleTireSeason;
  dot: string | null;
  treadMm: number | null;
  rimSize: string | null;
  notes: string | null;
  updatedAt: Date;
}): VehicleWheelFitmentRecord {
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    position: row.position,
    size: row.size,
    brand: row.brand,
    season: row.season,
    dot: row.dot,
    treadMm: row.treadMm,
    rimSize: row.rimSize,
    notes: row.notes,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type UpsertWheelDto = {
  position: VehicleWheelPosition;
  size?: string | null;
  brand?: string | null;
  season?: VehicleTireSeason;
  dot?: string | null;
  treadMm?: number | null;
  rimSize?: string | null;
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

    const data = {
      size: dto.size === undefined ? undefined : dto.size?.trim() || null,
      brand: dto.brand === undefined ? undefined : dto.brand?.trim() || null,
      season,
      dot: dto.dot === undefined ? undefined : dto.dot?.trim() || null,
      treadMm: treadMm === undefined ? undefined : treadMm,
      rimSize: dto.rimSize === undefined ? undefined : dto.rimSize?.trim() || null,
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
        season,
        dot: data.dot ?? null,
        treadMm: treadMm === undefined ? null : treadMm,
        rimSize: data.rimSize ?? null,
        notes: data.notes ?? null,
      },
      update: {
        ...(data.size !== undefined ? { size: data.size } : {}),
        ...(data.brand !== undefined ? { brand: data.brand } : {}),
        season,
        ...(data.dot !== undefined ? { dot: data.dot } : {}),
        ...(treadMm !== undefined ? { treadMm } : {}),
        ...(data.rimSize !== undefined ? { rimSize: data.rimSize } : {}),
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
  return {
    position: position as VehicleWheelPosition,
    size: o.size === undefined ? undefined : o.size === null ? null : String(o.size),
    brand: o.brand === undefined ? undefined : o.brand === null ? null : String(o.brand),
    season,
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
    notes: o.notes === undefined ? undefined : o.notes === null ? null : String(o.notes),
  };
}
