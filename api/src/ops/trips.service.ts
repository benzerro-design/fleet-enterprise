import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, TripPurpose, TripRoadType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { resolveOptionalClientVehicleFilter } from '../clients/client-resolve';
import { assertVehicleInTenant } from './ops-scope';
import { rejectOpsEntryVehicleIdChange } from './ops-patch-guards';
import { escapeCsvCell, MAX_EXPORT_ROWS } from './ops-csv';
import { buildConsumptionPayload } from './consumption-engine';
import type { ConsumptionPayload } from './consumption.types';
import type { FuelType } from '@prisma/client';
import { normalizeCivProfile } from '../fleet/vehicle-civ-fields';
import { resolveVehicleFuelType } from '../fleet/vehicle-fuel-resolve';

const MAX_PAGE_SIZE = 200;

export type CreateTripInput = {
  vehicleId: string;
  reference?: string | null;
  startedAt?: string;
  endedAt?: string | null;
  originLabel?: string | null;
  destLabel?: string | null;
  distanceKm?: number | null;
  purpose?: TripPurpose | null;
  roadType?: TripRoadType | null;
  odometerStartKm?: number | null;
  odometerEndKm?: number | null;
  driverName?: string | null;
};

export type PatchTripInput = Partial<CreateTripInput>;

export type TripBrowseFilters = {
  /** Număr înmatriculare (filtrare în tenant, fără sensibilitate la majuscule). */
  registrationNumber?: string;
  clientId?: string;
  q?: string;
  startedFrom?: string;
  startedTo?: string;
  /** `open` = fără dată de sfârșit, `closed` = cu dată de sfârșit */
  ended?: 'open' | 'closed';
};

export type TripListParams = TripBrowseFilters & {
  page: number;
  pageSize: number;
};

export type ConsumptionQuery = {
  from: string;
  to: string;
  vehicleIds?: string[];
  fuelTypes?: FuelType[];
};

function parseDayStart(s: string): Date {
  const t = s.trim();
  if (t.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return new Date(`${t}T00:00:00.000Z`);
  }
  const d = new Date(t);
  return d;
}

function parseDayEnd(s: string): Date {
  const t = s.trim();
  if (t.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return new Date(`${t}T23:59:59.999Z`);
  }
  const d = new Date(t);
  return d;
}

async function tripWhere(
  prisma: PrismaService,
  tenantId: string,
  f: TripBrowseFilters,
): Promise<Prisma.TripWhereInput> {
  const parts: Prisma.TripWhereInput[] = [{ tenantId }];
  if (f.registrationNumber?.trim()) {
    const reg = f.registrationNumber.trim();
    parts.push({
      vehicle: {
        tenantId,
        registrationNumber: { equals: reg, mode: 'insensitive' },
      },
    });
  }
  const clientVehicle = await resolveOptionalClientVehicleFilter(prisma, tenantId, f.clientId);
  if (clientVehicle) {
    parts.push({ vehicle: { tenantId, ...clientVehicle } });
  }
  if (f.q?.trim()) {
    const q = f.q.trim();
    parts.push({
      OR: [
        { reference: { contains: q, mode: 'insensitive' } },
        { originLabel: { contains: q, mode: 'insensitive' } },
        { destLabel: { contains: q, mode: 'insensitive' } },
      ],
    });
  }
  if (f.startedFrom?.trim()) {
    parts.push({ startedAt: { gte: parseDayStart(f.startedFrom) } });
  }
  if (f.startedTo?.trim()) {
    parts.push({ startedAt: { lte: parseDayEnd(f.startedTo) } });
  }
  if (f.ended === 'open') {
    parts.push({ endedAt: null });
  } else if (f.ended === 'closed') {
    parts.push({ endedAt: { not: null } });
  }
  return { AND: parts };
}

function resolveDistanceKm(input: {
  distanceKm?: number | null;
  odometerStartKm?: number | null;
  odometerEndKm?: number | null;
}): number | null {
  if (
    input.odometerStartKm != null &&
    input.odometerEndKm != null &&
    input.odometerEndKm >= input.odometerStartKm
  ) {
    return input.odometerEndKm - input.odometerStartKm;
  }
  return input.distanceKm ?? null;
}

function tripPatchFieldKeys(
  before: {
    vehicleId: string;
    reference: string | null;
    startedAt: Date;
    endedAt: Date | null;
    originLabel: string | null;
    destLabel: string | null;
    distanceKm: number | null;
    purpose: TripPurpose | null;
    roadType: TripRoadType | null;
    odometerStartKm: number | null;
    odometerEndKm: number | null;
    driverName: string | null;
  },
  dto: PatchTripInput,
): string[] {
  const keys: string[] = [];
  if (dto.vehicleId !== undefined && dto.vehicleId !== before.vehicleId) keys.push('vehicleId');
  if (dto.reference !== undefined && dto.reference !== before.reference) keys.push('reference');
  if (dto.startedAt !== undefined) {
    const next = new Date(dto.startedAt);
    if (next.getTime() !== before.startedAt.getTime()) keys.push('startedAt');
  }
  if (dto.endedAt !== undefined) {
    const next = dto.endedAt ? new Date(dto.endedAt) : null;
    const prev = before.endedAt;
    const prevMs = prev ? prev.getTime() : null;
    const nextMs = next ? next.getTime() : null;
    if (prevMs !== nextMs) keys.push('endedAt');
  }
  if (dto.originLabel !== undefined && dto.originLabel !== before.originLabel) keys.push('originLabel');
  if (dto.destLabel !== undefined && dto.destLabel !== before.destLabel) keys.push('destLabel');
  if (dto.distanceKm !== undefined && dto.distanceKm !== before.distanceKm) keys.push('distanceKm');
  if (dto.purpose !== undefined && dto.purpose !== before.purpose) keys.push('purpose');
  if (dto.roadType !== undefined && dto.roadType !== before.roadType) keys.push('roadType');
  if (dto.odometerStartKm !== undefined && dto.odometerStartKm !== before.odometerStartKm) {
    keys.push('odometerStartKm');
  }
  if (dto.odometerEndKm !== undefined && dto.odometerEndKm !== before.odometerEndKm) {
    keys.push('odometerEndKm');
  }
  if (dto.driverName !== undefined && dto.driverName !== before.driverName) keys.push('driverName');
  return keys;
}

function toTripRow(row: {
  id: string;
  tenantId: string;
  vehicleId: string;
  reference: string | null;
  startedAt: Date;
  endedAt: Date | null;
  originLabel: string | null;
  destLabel: string | null;
  distanceKm: number | null;
  purpose: TripPurpose | null;
  roadType: TripRoadType | null;
  odometerStartKm: number | null;
  odometerEndKm: number | null;
  driverName: string | null;
  vehicle: { registrationNumber: string; client: { code: string } };
  tenant: { slug: string };
}) {
  return {
    id: row.id,
    tenantSlug: row.tenant.slug,
    vehicleId: row.vehicleId,
    registrationNumber: row.vehicle.registrationNumber,
    clientId: row.vehicle.client.code,
    reference: row.reference,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    originLabel: row.originLabel,
    destLabel: row.destLabel,
    distanceKm: row.distanceKm,
    purpose: row.purpose,
    roadType: row.roadType,
    odometerStartKm: row.odometerStartKm,
    odometerEndKm: row.odometerEndKm,
    driverName: row.driverName,
  };
}

@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantSlug: string, params: TripListParams) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return { items: [], total: 0, page: params.page, pageSize: params.pageSize };
    }
    const pageSize = Math.min(Math.max(1, params.pageSize), MAX_PAGE_SIZE);
    const page = Math.max(1, params.page);
    const skip = (page - 1) * pageSize;

    const where = await tripWhere(this.prisma, tenant.id, {
      registrationNumber: params.registrationNumber,
      clientId: params.clientId,
      q: params.q,
      startedFrom: params.startedFrom,
      startedTo: params.startedTo,
      ended: params.ended,
    });

    const [total, rows] = await Promise.all([
      this.prisma.trip.count({ where }),
      this.prisma.trip.findMany({
        where,
        include: {
          vehicle: { select: { registrationNumber: true, client: { select: { code: true } } } },
          tenant: { select: { slug: true } },
        },
        orderBy: { startedAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map(toTripRow),
      total,
      page,
      pageSize,
    };
  }

  async exportCsv(tenantSlug: string, filters: TripBrowseFilters): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return '\uFEFFid,vehicleId,registrationNumber,clientId,reference,startedAt,endedAt,originLabel,destLabel,distanceKm\n';
    }
    const where = await tripWhere(this.prisma, tenant.id, filters);
    const rows = await this.prisma.trip.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: MAX_EXPORT_ROWS,
      include: { vehicle: { select: { registrationNumber: true, client: { select: { code: true } } } } },
    });
    const header =
      'id,vehicleId,registrationNumber,clientId,reference,startedAt,endedAt,originLabel,destLabel,distanceKm,purpose,roadType,odometerStartKm,odometerEndKm,driverName';
    const lines = rows.map((r) =>
      [
        r.id,
        r.vehicleId,
        r.vehicle.registrationNumber,
        r.vehicle.client.code,
        r.reference ?? '',
        r.startedAt.toISOString(),
        r.endedAt ? r.endedAt.toISOString() : '',
        r.originLabel ?? '',
        r.destLabel ?? '',
        r.distanceKm != null ? String(r.distanceKm) : '',
        r.purpose ?? '',
        r.roadType ?? '',
        r.odometerStartKm != null ? String(r.odometerStartKm) : '',
        r.odometerEndKm != null ? String(r.odometerEndKm) : '',
        r.driverName ?? '',
      ]
        .map((c) => escapeCsvCell(c))
        .join(','),
    );
    return `\uFEFF${header}\n${lines.join('\n')}\n`;
  }

  async getById(tenantSlug: string, tripId: string) {
    const row = await this.prisma.trip.findFirst({
      where: { id: tripId, tenant: { slug: tenantSlug } },
      include: {
        vehicle: { select: { registrationNumber: true, client: { select: { code: true } } } },
        tenant: { select: { slug: true } },
      },
    });
    if (!row) throw new NotFoundException('Trip not found');
    return toTripRow(row);
  }

  async create(tenantSlug: string, dto: CreateTripInput, actorUserId?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    await assertVehicleInTenant(this.prisma, tenantSlug, dto.vehicleId);

    const row = await this.prisma.trip.create({
      data: {
        tenantId: tenant.id,
        vehicleId: dto.vehicleId,
        reference: dto.reference ?? null,
        startedAt: dto.startedAt ? new Date(dto.startedAt) : new Date(),
        endedAt: dto.endedAt === undefined ? undefined : dto.endedAt ? new Date(dto.endedAt) : null,
        originLabel: dto.originLabel ?? null,
        destLabel: dto.destLabel ?? null,
        distanceKm: resolveDistanceKm({
          distanceKm: dto.distanceKm ?? null,
          odometerStartKm: dto.odometerStartKm ?? null,
          odometerEndKm: dto.odometerEndKm ?? null,
        }),
        purpose: dto.purpose ?? null,
        roadType: dto.roadType ?? null,
        odometerStartKm: dto.odometerStartKm ?? null,
        odometerEndKm: dto.odometerEndKm ?? null,
        driverName: dto.driverName ?? null,
      },
      include: {
        vehicle: { select: { registrationNumber: true, client: { select: { code: true } } } },
        tenant: { select: { slug: true } },
      },
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId: actorUserId ?? undefined,
      action: 'create',
      entityType: 'trip',
      entityId: row.id,
      meta: {
        registrationNumber: row.vehicle.registrationNumber,
        clientId: row.vehicle.client.code,
        reference: row.reference,
        vehicleId: row.vehicleId,
      },
    });

    return toTripRow(row);
  }

  async patch(tenantSlug: string, tripId: string, dto: PatchTripInput, actorUserId?: string) {
    const before = await this.prisma.trip.findFirst({
      where: { id: tripId, tenant: { slug: tenantSlug } },
      include: {
        vehicle: { select: { registrationNumber: true, client: { select: { code: true } } } },
        tenant: true,
      },
    });
    if (!before) throw new NotFoundException('Trip not found');

    rejectOpsEntryVehicleIdChange(dto.vehicleId, before.vehicleId);

    const nextOdometerStartKm =
      dto.odometerStartKm !== undefined ? dto.odometerStartKm : before.odometerStartKm;
    const nextOdometerEndKm =
      dto.odometerEndKm !== undefined ? dto.odometerEndKm : before.odometerEndKm;
    const nextDistanceKm = resolveDistanceKm({
      distanceKm: dto.distanceKm !== undefined ? dto.distanceKm : before.distanceKm,
      odometerStartKm: nextOdometerStartKm,
      odometerEndKm: nextOdometerEndKm,
    });

    const data: Prisma.TripUncheckedUpdateManyInput = {
      reference: dto.reference,
      startedAt: dto.startedAt !== undefined ? new Date(dto.startedAt) : undefined,
      endedAt:
        dto.endedAt === undefined ? undefined : dto.endedAt ? new Date(dto.endedAt) : null,
      originLabel: dto.originLabel,
      destLabel: dto.destLabel,
      distanceKm: dto.distanceKm !== undefined || dto.odometerStartKm !== undefined || dto.odometerEndKm !== undefined
        ? nextDistanceKm
        : undefined,
      purpose: dto.purpose,
      roadType: dto.roadType,
      odometerStartKm: dto.odometerStartKm,
      odometerEndKm: dto.odometerEndKm,
      driverName: dto.driverName,
    };

    const r = await this.prisma.trip.updateMany({
      where: { id: tripId, tenant: { slug: tenantSlug } },
      data,
    });
    if (r.count === 0) throw new NotFoundException('Trip not found');

    const fields = tripPatchFieldKeys(
      {
        vehicleId: before.vehicleId,
        reference: before.reference,
        startedAt: before.startedAt,
        endedAt: before.endedAt,
        originLabel: before.originLabel,
        destLabel: before.destLabel,
        distanceKm: before.distanceKm,
        purpose: before.purpose,
        roadType: before.roadType,
        odometerStartKm: before.odometerStartKm,
        odometerEndKm: before.odometerEndKm,
        driverName: before.driverName,
      },
      dto,
    );

    await this.audit.log({
      tenantId: before.tenantId,
      actorUserId: actorUserId ?? undefined,
      action: 'update',
      entityType: 'trip',
      entityId: tripId,
      meta: {
        registrationNumber: before.vehicle.registrationNumber,
        clientId: before.vehicle.client.code,
        fields,
      },
    });

    return this.getById(tenantSlug, tripId);
  }

  async delete(tenantSlug: string, tripId: string, actorUserId?: string) {
    const row = await this.prisma.trip.findFirst({
      where: { id: tripId, tenant: { slug: tenantSlug } },
      include: { vehicle: { select: { registrationNumber: true, client: { select: { code: true } } } } },
    });
    if (!row) throw new NotFoundException('Trip not found');

    await this.audit.log({
      tenantId: row.tenantId,
      actorUserId: actorUserId ?? undefined,
      action: 'delete',
      entityType: 'trip',
      entityId: tripId,
      meta: {
        registrationNumber: row.vehicle.registrationNumber,
        clientId: row.vehicle.client.code,
        reference: row.reference,
      },
    });

    await this.prisma.trip.deleteMany({
      where: { id: tripId, tenant: { slug: tenantSlug } },
    });
  }

  async getConsumption(tenantSlug: string, query: ConsumptionQuery): Promise<ConsumptionPayload> {
    const from = parseDayStart(query.from);
    const to = parseDayEnd(query.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      throw new BadRequestException('Invalid consumption period');
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return buildConsumptionPayload({
        periodStart: from,
        periodEnd: to,
        vehicleScope: 'all',
        selectedVehicleCount: 0,
        fuelTypeFilter: query.fuelTypes?.length ? query.fuelTypes : null,
        vehicleFuelById: new Map(),
        trips: [],
        costs: [],
        allFuelCostsForSegments: [],
        odometerReadings: [],
      });
    }

    const vehicleIds = [...new Set((query.vehicleIds ?? []).map((id) => id.trim()).filter(Boolean))];
    const vehicleScope = vehicleIds.length > 0 ? 'selected' : 'all';
    const fuelTypeFilter = query.fuelTypes?.length ? query.fuelTypes : null;

    for (const vehicleId of vehicleIds) {
      await assertVehicleInTenant(this.prisma, tenantSlug, vehicleId);
    }

    const tenantVehicles = await this.prisma.vehicle.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, fuelType: true, civProfile: true },
    });

    const vehicleFuelById = new Map<string, FuelType | null>();
    for (const v of tenantVehicles) {
      vehicleFuelById.set(
        v.id,
        resolveVehicleFuelType({
          fuelType: v.fuelType,
          civProfile: normalizeCivProfile(v.civProfile),
        }),
      );
    }

    let allowedVehicleIds = vehicleIds.length > 0 ? vehicleIds : tenantVehicles.map((v) => v.id);

    if (fuelTypeFilter?.length) {
      const fillVehicleRows = await this.prisma.costEntry.findMany({
        where: {
          tenantId: tenant.id,
          incurredOn: { gte: from, lte: to },
          category: { equals: 'Combustibil', mode: 'insensitive' },
          fuelProductType: { in: fuelTypeFilter },
          fuelLiters: { gt: 0 },
          ...(vehicleIds.length > 0 ? { vehicleId: { in: vehicleIds } } : {}),
        },
        select: { vehicleId: true },
        distinct: ['vehicleId'],
      });
      allowedVehicleIds = fillVehicleRows.map((r) => r.vehicleId);
    }

    const vehicleFilter: Prisma.VehicleWhereInput =
      allowedVehicleIds.length > 0 ? { id: { in: allowedVehicleIds } } : { id: { in: [] } };

    const tripWhere: Prisma.TripWhereInput = {
      tenantId: tenant.id,
      startedAt: { gte: from, lte: to },
      vehicle: vehicleFilter,
    };

    const costWhere: Prisma.CostEntryWhereInput = {
      tenantId: tenant.id,
      incurredOn: { gte: from, lte: to },
      vehicle: vehicleFilter,
      category: { equals: 'Combustibil', mode: 'insensitive' },
      ...(fuelTypeFilter?.length ? { fuelProductType: { in: fuelTypeFilter } } : {}),
    };

    const segmentCostWhere: Prisma.CostEntryWhereInput = {
      tenantId: tenant.id,
      vehicle: vehicleFilter,
      category: { equals: 'Combustibil', mode: 'insensitive' },
      fuelLiters: { gt: 0 },
      ...(fuelTypeFilter?.length ? { fuelProductType: { in: fuelTypeFilter } } : {}),
    };

    const vehicleSelect = {
      select: { registrationNumber: true, client: { select: { code: true } } },
    } as const;

    const [trips, costs, allFuelCostsForSegments, odometerReadings] = await Promise.all([
      this.prisma.trip.findMany({
        where: tripWhere,
        include: { vehicle: vehicleSelect },
        orderBy: { startedAt: 'desc' },
        take: 2000,
      }),
      this.prisma.costEntry.findMany({
        where: costWhere,
        include: { vehicle: vehicleSelect },
        orderBy: { incurredOn: 'desc' },
        take: 2000,
      }),
      this.prisma.costEntry.findMany({
        where: segmentCostWhere,
        include: { vehicle: vehicleSelect },
        orderBy: { incurredOn: 'asc' },
        take: 5000,
      }),
      this.prisma.odometerReading.findMany({
        where: {
          recordedAt: { gte: from, lte: to },
          vehicle: vehicleFilter,
        },
        orderBy: { recordedAt: 'asc' },
        take: 5000,
      }),
    ]);

    const mapCost = (c: (typeof costs)[number]) => ({
      id: c.id,
      vehicleId: c.vehicleId,
      registrationNumber: c.vehicle.registrationNumber,
      clientId: c.vehicle.client.code,
      category: c.category,
      incurredOn: c.incurredOn,
      fuelLiters: c.fuelLiters,
      fuelProductType: c.fuelProductType,
      odometerKm: c.odometerKm,
      amountCents: c.amountCents,
      provider: c.provider,
    });

    return buildConsumptionPayload({
      periodStart: from,
      periodEnd: to,
      vehicleScope,
      selectedVehicleCount: vehicleIds.length,
      fuelTypeFilter,
      vehicleFuelById,
      trips: trips.map((t) => ({
        id: t.id,
        vehicleId: t.vehicleId,
        registrationNumber: t.vehicle.registrationNumber,
        clientId: t.vehicle.client.code,
        startedAt: t.startedAt,
        endedAt: t.endedAt,
        reference: t.reference,
        originLabel: t.originLabel,
        destLabel: t.destLabel,
        distanceKm: t.distanceKm,
        odometerStartKm: t.odometerStartKm,
        odometerEndKm: t.odometerEndKm,
      })),
      costs: costs.map(mapCost),
      allFuelCostsForSegments: allFuelCostsForSegments.map(mapCost),
      odometerReadings: odometerReadings.map((r) => ({
        recordedAt: r.recordedAt,
        odometerKm: r.odometerKm,
      })),
    });
  }
}
