import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AccessContext } from '../iam/access-context.types';
import {
  isDriverOnlyClientUser,
  isTenantWideAccess,
} from '../iam/client-access';
import { driverIdsFromAccess } from '../iam/driver-access';
import { PrismaService } from '../prisma/prisma.service';
import { assertVehicleOpsWrite } from './ops-write-access';

export type TachographDayInput = {
  vehicleId?: string;
  driverId?: string;
  day?: string;
  drivingMinutes?: number;
  otherWorkMinutes?: number;
  availabilityMinutes?: number;
  restMinutes?: number;
  notes?: string | null;
  slipFileUrl?: string | null;
  slipFileName?: string | null;
};

function parseDay(raw: string | undefined): Date {
  const value = raw?.trim() ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException('day must be YYYY-MM-DD');
  }
  const day = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(day.getTime())) throw new BadRequestException('day is invalid');
  return day;
}

function parseMinutes(raw: unknown, field: string): number {
  if (raw === undefined || raw === null || raw === '') return 0;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 24 * 60) {
    throw new BadRequestException(`${field} must be an integer between 0 and 1440`);
  }
  return n;
}

function parseSlip(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const value = raw.trim();
  if (!value) return null;
  if (!value.startsWith('/uploads/') || value.length > 400) {
    throw new BadRequestException('slipFileUrl must be an uploaded file');
  }
  return value;
}

function dayKey(day: Date): string {
  return day.toISOString().slice(0, 10);
}

@Injectable()
export class TachographService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    tenantSlug: string,
    access: AccessContext | undefined,
    query: { from?: string; to?: string; vehicleId?: string; driverId?: string },
  ) {
    const tenant = await this.tenantOrThrow(tenantSlug);
    const from = query.from?.trim() ? parseDay(query.from) : undefined;
    const to = query.to?.trim() ? parseDay(query.to) : undefined;
    const where: Prisma.TachographDayWhereInput = { tenantId: tenant.id };
    if (from || to) {
      where.day = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
    }
    if (query.vehicleId?.trim()) where.vehicleId = query.vehicleId.trim();
    if (query.driverId?.trim()) where.driverId = query.driverId.trim();
    this.applyScope(where, access);

    const rows = await this.prisma.tachographDay.findMany({
      where,
      orderBy: [{ day: 'desc' }, { vehicle: { registrationNumber: 'asc' } }],
      take: 400,
      include: {
        vehicle: { select: { registrationNumber: true, clientId: true } },
        driver: { select: { fullName: true } },
      },
    });

    const items = rows.map((row) => ({
      id: row.id,
      vehicleId: row.vehicleId,
      registrationNumber: row.vehicle.registrationNumber,
      clientId: row.vehicle.clientId,
      driverId: row.driverId,
      driverName: row.driver.fullName,
      day: dayKey(row.day),
      drivingMinutes: row.drivingMinutes,
      otherWorkMinutes: row.otherWorkMinutes,
      availabilityMinutes: row.availabilityMinutes,
      restMinutes: row.restMinutes,
      notes: row.notes,
      slipFileUrl: row.slipFileUrl,
      slipFileName: row.slipFileName,
    }));

    const totals = items.reduce(
      (acc, row) => {
        acc.drivingMinutes += row.drivingMinutes;
        acc.otherWorkMinutes += row.otherWorkMinutes;
        acc.availabilityMinutes += row.availabilityMinutes;
        acc.restMinutes += row.restMinutes;
        acc.days += 1;
        return acc;
      },
      { days: 0, drivingMinutes: 0, otherWorkMinutes: 0, availabilityMinutes: 0, restMinutes: 0 },
    );

    return { items, totals };
  }

  async upsert(tenantSlug: string, access: AccessContext | undefined, body: TachographDayInput) {
    const tenant = await this.tenantOrThrow(tenantSlug);
    const vehicleId = body.vehicleId?.trim() ?? '';
    const driverId = body.driverId?.trim() ?? '';
    if (!vehicleId || !driverId) throw new BadRequestException('vehicleId and driverId are required');
    const day = parseDay(body.day);
    await this.assertWrite(tenantSlug, access, vehicleId, driverId);

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    const driver = await this.prisma.driver.findFirst({
      where: { id: driverId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    const slipProvided = body.slipFileUrl !== undefined;
    const data = {
      drivingMinutes: parseMinutes(body.drivingMinutes, 'drivingMinutes'),
      otherWorkMinutes: parseMinutes(body.otherWorkMinutes, 'otherWorkMinutes'),
      availabilityMinutes: parseMinutes(body.availabilityMinutes, 'availabilityMinutes'),
      restMinutes: parseMinutes(body.restMinutes, 'restMinutes'),
      notes: body.notes?.trim() ? body.notes.trim() : null,
      ...(slipProvided
        ? {
            slipFileUrl: parseSlip(body.slipFileUrl),
            slipFileName: body.slipFileName?.trim() ? body.slipFileName.trim().slice(0, 180) : null,
          }
        : {}),
    };

    const row = await this.prisma.tachographDay.upsert({
      where: {
        tenantId_vehicleId_driverId_day: { tenantId: tenant.id, vehicleId, driverId, day },
      },
      create: { tenantId: tenant.id, vehicleId, driverId, day, ...data },
      update: data,
      include: {
        vehicle: { select: { registrationNumber: true, clientId: true } },
        driver: { select: { fullName: true } },
      },
    });

    return {
      id: row.id,
      vehicleId: row.vehicleId,
      registrationNumber: row.vehicle.registrationNumber,
      clientId: row.vehicle.clientId,
      driverId: row.driverId,
      driverName: row.driver.fullName,
      day: dayKey(row.day),
      drivingMinutes: row.drivingMinutes,
      otherWorkMinutes: row.otherWorkMinutes,
      availabilityMinutes: row.availabilityMinutes,
      restMinutes: row.restMinutes,
      notes: row.notes,
      slipFileUrl: row.slipFileUrl,
      slipFileName: row.slipFileName,
    };
  }

  async remove(tenantSlug: string, access: AccessContext | undefined, id: string) {
    const tenant = await this.tenantOrThrow(tenantSlug);
    const row = await this.prisma.tachographDay.findFirst({
      where: { id, tenantId: tenant.id },
    });
    if (!row) throw new NotFoundException('Tachograph day not found');
    await this.assertWrite(tenantSlug, access, row.vehicleId, row.driverId);
    await this.prisma.tachographDay.delete({ where: { id: row.id } });
    return { ok: true };
  }

  private applyScope(where: Prisma.TachographDayWhereInput, access: AccessContext | undefined) {
    if (!access || isTenantWideAccess(access)) return;
    if (isDriverOnlyClientUser(access)) {
      const vehicles = access.assignedVehicleIds ?? [];
      const drivers = driverIdsFromAccess(access);
      const requestedVehicle = typeof where.vehicleId === 'string' ? where.vehicleId : undefined;
      const requestedDriver = typeof where.driverId === 'string' ? where.driverId : undefined;
      where.vehicleId = requestedVehicle
        ? vehicles.includes(requestedVehicle)
          ? requestedVehicle
          : { in: [] }
        : { in: vehicles };
      where.driverId = requestedDriver
        ? drivers.includes(requestedDriver)
          ? requestedDriver
          : { in: [] }
        : { in: drivers };
      return;
    }
    const clients = access.allowedClientIds;
    where.vehicle = { clientId: { in: clients.length ? clients : ['__none__'] } };
  }

  private async assertWrite(
    tenantSlug: string,
    access: AccessContext | undefined,
    vehicleId: string,
    driverId: string,
  ) {
    if (!access) throw new ForbiddenException('Insufficient permissions');
    if (isDriverOnlyClientUser(access)) {
      const vehicles = access.assignedVehicleIds ?? [];
      const drivers = driverIdsFromAccess(access);
      if (!vehicles.includes(vehicleId) || !drivers.includes(driverId)) {
        throw new ForbiddenException('Șoferul poate înregistra doar vehiculul și conducătorul alocat');
      }
      return;
    }
    await assertVehicleOpsWrite(this.prisma, tenantSlug, vehicleId, access);
  }

  private async tenantOrThrow(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }
}
