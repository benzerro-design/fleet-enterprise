import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, TripPurpose, TripRoadType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { assertVehicleInTenant } from './ops-scope';
import { escapeCsvCell, MAX_EXPORT_ROWS } from './ops-csv';

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

function tripWhere(tenantId: string, f: TripBrowseFilters): Prisma.TripWhereInput {
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
  if (f.clientId?.trim()) {
    const clientId = f.clientId.trim();
    parts.push({
      vehicle: {
        tenantId,
        clientId: { equals: clientId, mode: 'insensitive' },
      },
    });
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
  vehicle: { registrationNumber: string; clientId: string };
  tenant: { slug: string };
}) {
  return {
    id: row.id,
    tenantSlug: row.tenant.slug,
    vehicleId: row.vehicleId,
    registrationNumber: row.vehicle.registrationNumber,
    clientId: row.vehicle.clientId,
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

    const where = tripWhere(tenant.id, {
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
          vehicle: { select: { registrationNumber: true, clientId: true } },
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
    const where = tripWhere(tenant.id, filters);
    const rows = await this.prisma.trip.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: MAX_EXPORT_ROWS,
      include: { vehicle: { select: { registrationNumber: true, clientId: true } } },
    });
    const header =
      'id,vehicleId,registrationNumber,clientId,reference,startedAt,endedAt,originLabel,destLabel,distanceKm,purpose,roadType,odometerStartKm,odometerEndKm,driverName';
    const lines = rows.map((r) =>
      [
        r.id,
        r.vehicleId,
        r.vehicle.registrationNumber,
        r.vehicle.clientId,
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
        vehicle: { select: { registrationNumber: true, clientId: true } },
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
        distanceKm: dto.distanceKm ?? null,
        purpose: dto.purpose ?? null,
        roadType: dto.roadType ?? null,
        odometerStartKm: dto.odometerStartKm ?? null,
        odometerEndKm: dto.odometerEndKm ?? null,
        driverName: dto.driverName ?? null,
      },
      include: {
        vehicle: { select: { registrationNumber: true, clientId: true } },
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
        clientId: row.vehicle.clientId,
        reference: row.reference,
        vehicleId: row.vehicleId,
      },
    });

    return toTripRow(row);
  }

  async patch(tenantSlug: string, tripId: string, dto: PatchTripInput, actorUserId?: string) {
    if (dto.vehicleId) {
      await assertVehicleInTenant(this.prisma, tenantSlug, dto.vehicleId);
    }

    const before = await this.prisma.trip.findFirst({
      where: { id: tripId, tenant: { slug: tenantSlug } },
      include: { vehicle: { select: { registrationNumber: true, clientId: true } }, tenant: true },
    });
    if (!before) throw new NotFoundException('Trip not found');

    const data: Prisma.TripUncheckedUpdateManyInput = {
      vehicleId: dto.vehicleId,
      reference: dto.reference,
      startedAt: dto.startedAt !== undefined ? new Date(dto.startedAt) : undefined,
      endedAt:
        dto.endedAt === undefined ? undefined : dto.endedAt ? new Date(dto.endedAt) : null,
      originLabel: dto.originLabel,
      destLabel: dto.destLabel,
      distanceKm: dto.distanceKm,
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
        clientId: before.vehicle.clientId,
        fields,
      },
    });

    return this.getById(tenantSlug, tripId);
  }

  async delete(tenantSlug: string, tripId: string, actorUserId?: string) {
    const row = await this.prisma.trip.findFirst({
      where: { id: tripId, tenant: { slug: tenantSlug } },
      include: { vehicle: { select: { registrationNumber: true, clientId: true } } },
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
        clientId: row.vehicle.clientId,
        reference: row.reference,
      },
    });

    await this.prisma.trip.deleteMany({
      where: { id: tripId, tenant: { slug: tenantSlug } },
    });
  }
}
