import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DriverStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { resolveClientInTenant } from '../clients/client-resolve';
import type { AccessContext } from '../iam/access-context.types';
import {
  canAccessClientFleet,
  driverClientScope,
  isDriverOnlyClientUser,
} from '../iam/client-access';
import { assertClientCodeOpsWrite, assertDriverOpsWrite, assertVehicleOpsRead, assertVehicleOpsWrite } from '../ops/ops-write-access';
import { licenseExpiryStatus, licenseExpiryWhere, type LicenseExpiryStatus } from './license-expiry';

const MAX_PAGE_SIZE = 200;

export type DriverRecord = {
  id: string;
  clientId: string;
  clientCode: string;
  clientLegalName: string;
  fullName: string;
  employeeCode: string | null;
  phone: string | null;
  email: string | null;
  licenseNumber: string | null;
  licenseCategories: string | null;
  licenseExpiresOn: string | null;
  licenseExpiryStatus: LicenseExpiryStatus;
  status: DriverStatus;
  notes: string | null;
  activeVehicleIds: string[];
  activeVehicleRegistrations: string[];
  createdAt: string;
  updatedAt: string;
};

export type DriverAssignmentRecord = {
  id: string;
  driverId: string;
  driverFullName?: string | null;
  vehicleId: string;
  registrationNumber: string;
  assignedAt: string;
  unassignedAt: string | null;
  assignedByUserId: string | null;
  assignedByEmail: string | null;
  notes: string | null;
};

export type DriverDetailPayload = {
  driver: DriverRecord;
  assignments: DriverAssignmentRecord[];
};

export type CreateDriverInput = {
  clientId: string;
  fullName: string;
  employeeCode?: string | null;
  phone?: string | null;
  email?: string | null;
  licenseNumber?: string | null;
  licenseCategories?: string | null;
  licenseExpiresOn?: string | null;
  status?: DriverStatus;
  notes?: string | null;
};

export type PatchDriverInput = Partial<Omit<CreateDriverInput, 'clientId'>> & {
  clientId?: string;
};

export type DriverLicenseAlert = {
  driverId: string;
  fullName: string;
  clientId: string;
  clientCode: string;
  licenseExpiresOn: string;
  licenseExpiryStatus: 'expiring' | 'expired';
  daysUntilExpiry: number;
};

export type CreateAssignmentInput = {
  vehicleId: string;
  notes?: string | null;
  assignedAt?: string;
};

@Injectable()
export class DriversService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listPaged(
    tenantSlug: string,
    params: {
      page?: number;
      pageSize?: number;
      q?: string;
      clientId?: string;
      status?: DriverStatus;
      licenseExpiry?: 'expiring' | 'expired';
    },
    access?: AccessContext,
  ) {
    if (access && isDriverOnlyClientUser(access)) {
      return { items: [], total: 0, page: params.page ?? 1, pageSize: params.pageSize ?? 50 };
    }
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return { items: [], total: 0, page: params.page ?? 1, pageSize: params.pageSize ?? 50 };
    }

    const pageSize = Math.min(Math.max(1, params.pageSize ?? 50), MAX_PAGE_SIZE);
    const page = Math.max(1, params.page ?? 1);
    const skip = (page - 1) * pageSize;
    const resolvedClientId = params.clientId
      ? (await resolveClientInTenant(this.prisma, tenant.id, params.clientId)).id
      : undefined;
    const where = this.listWhere(tenant.id, { ...params, clientId: resolvedClientId }, access);

    const [total, rows] = await Promise.all([
      this.prisma.driver.count({ where }),
      this.prisma.driver.findMany({
        where,
        orderBy: [{ status: 'asc' }, { fullName: 'asc' }],
        skip,
        take: pageSize,
        include: {
          client: { select: { code: true, legalName: true } },
          vehicleAssignments: {
            where: { unassignedAt: null },
            include: { vehicle: { select: { id: true, registrationNumber: true } } },
          },
        },
      }),
    ]);

    return {
      items: rows.map((r) => this.toRecord(r)),
      total,
      page,
      pageSize,
    };
  }

  async listForClient(tenantSlug: string, clientId: string): Promise<DriverRecord[]> {
    const tenant = await this.ensureTenant(tenantSlug);
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId: tenant.id },
    });
    if (!client) throw new NotFoundException('Client not found');

    const rows = await this.prisma.driver.findMany({
      where: { tenantId: tenant.id, clientId },
      orderBy: [{ status: 'asc' }, { fullName: 'asc' }],
      include: {
        client: { select: { code: true, legalName: true } },
        vehicleAssignments: {
          where: { unassignedAt: null },
          include: { vehicle: { select: { id: true, registrationNumber: true } } },
        },
      },
    });

    return rows.map((r) => this.toRecord(r));
  }

  async listLicenseAlerts(
    tenantSlug: string,
    limit = 20,
    access?: AccessContext,
  ): Promise<DriverLicenseAlert[]> {
    if (access && isDriverOnlyClientUser(access)) return [];
    const tenant = await this.ensureTenant(tenantSlug);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const scope = access ? driverClientScope(access) : {};

    const rows = await this.prisma.driver.findMany({
      where: {
        tenantId: tenant.id,
        status: DriverStatus.active,
        licenseExpiresOn: { not: null },
        ...scope,
      },
      include: { client: { select: { code: true } } },
      orderBy: [{ licenseExpiresOn: 'asc' }],
      take: 500,
    });

    const alerts: DriverLicenseAlert[] = [];
    for (const row of rows) {
      if (!row.licenseExpiresOn) continue;
      const status = licenseExpiryStatus(row.licenseExpiresOn);
      if (status !== 'expiring' && status !== 'expired') continue;
      const exp = new Date(row.licenseExpiresOn);
      exp.setUTCHours(0, 0, 0, 0);
      const daysUntilExpiry = Math.round((exp.getTime() - today.getTime()) / 86_400_000);
      alerts.push({
        driverId: row.id,
        fullName: row.fullName,
        clientId: row.clientId,
        clientCode: row.client.code,
        licenseExpiresOn: row.licenseExpiresOn.toISOString(),
        licenseExpiryStatus: status,
        daysUntilExpiry,
      });
    }

    return alerts.slice(0, Math.min(Math.max(1, limit), 100));
  }

  async getById(tenantSlug: string, id: string): Promise<DriverRecord> {
    const row = await this.findDriverRow(tenantSlug, id);
    return this.toRecord(row);
  }

  async getDetail(tenantSlug: string, id: string, access?: AccessContext): Promise<DriverDetailPayload> {
    const row = await this.findDriverRow(tenantSlug, id);
    if (access && !canAccessClientFleet(access)) {
      throw new NotFoundException('Driver not found');
    }
    if (access && !access.isTenantWide && !access.allowedClientIds.includes(row.clientId)) {
      throw new NotFoundException('Driver not found');
    }
    const assignments = await this.listAssignments(tenantSlug, id, access);
    return { driver: this.toRecord(row), assignments };
  }

  async listAssignments(
    tenantSlug: string,
    driverId: string,
    access?: AccessContext,
  ): Promise<DriverAssignmentRecord[]> {
    const row = await this.findDriverRow(tenantSlug, driverId);
    if (access && !access.isTenantWide && !access.allowedClientIds.includes(row.clientId)) {
      throw new NotFoundException('Driver not found');
    }
    const rows = await this.prisma.driverVehicleAssignment.findMany({
      where: { driverId },
      include: {
        vehicle: { select: { registrationNumber: true } },
        assignedBy: { select: { email: true } },
      },
      orderBy: [{ assignedAt: 'desc' }],
    });
    return rows.map((r) => this.toAssignmentRecord(r));
  }

  async listVehicleAssignments(
    tenantSlug: string,
    vehicleId: string,
    access?: AccessContext,
  ): Promise<DriverAssignmentRecord[]> {
    await assertVehicleOpsRead(this.prisma, tenantSlug, vehicleId, access);
    const tenant = await this.ensureTenant(tenantSlug);
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, tenantId: tenant.id },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const rows = await this.prisma.driverVehicleAssignment.findMany({
      where: { vehicleId },
      include: {
        vehicle: { select: { registrationNumber: true } },
        driver: { select: { fullName: true } },
        assignedBy: { select: { email: true } },
      },
      orderBy: [{ assignedAt: 'desc' }],
    });
    return rows.map((r) => this.toAssignmentRecord(r));
  }

  async create(
    tenantSlug: string,
    input: CreateDriverInput,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<DriverRecord> {
    const tenant = await this.ensureTenant(tenantSlug);
    const fullName = input.fullName?.trim();
    if (!fullName) throw new BadRequestException('fullName is required');

    await assertClientCodeOpsWrite(this.prisma, tenant.id, input.clientId, access);
    const client = await resolveClientInTenant(this.prisma, tenant.id, input.clientId);

    const row = await this.prisma.driver.create({
      data: {
        tenantId: tenant.id,
        clientId: client.id,
        fullName,
        employeeCode: input.employeeCode?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        licenseNumber: input.licenseNumber?.trim() || null,
        licenseCategories: input.licenseCategories?.trim() || null,
        licenseExpiresOn: parseOptionalDate(input.licenseExpiresOn),
        status: input.status ?? DriverStatus.active,
        notes: input.notes?.trim() || null,
      },
      include: {
        client: { select: { code: true, legalName: true } },
        vehicleAssignments: {
          where: { unassignedAt: null },
          include: { vehicle: { select: { id: true, registrationNumber: true } } },
        },
      },
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'driver.create',
      entityType: 'driver',
      entityId: row.id,
      meta: { fullName: row.fullName, clientCode: row.client.code },
    });

    return this.toRecord(row);
  }

  async patch(
    tenantSlug: string,
    id: string,
    input: PatchDriverInput,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<DriverRecord> {
    await assertDriverOpsWrite(this.prisma, tenantSlug, id, access);
    const tenant = await this.ensureTenant(tenantSlug);
    const existing = await this.findDriverRow(tenantSlug, id);

    let resolvedClientId: string | undefined;
    if (input.clientId !== undefined) {
      await assertClientCodeOpsWrite(this.prisma, tenant.id, input.clientId, access);
      const client = await resolveClientInTenant(this.prisma, tenant.id, input.clientId);
      if (client.id !== existing.clientId) {
        const activeAssignments = await this.prisma.driverVehicleAssignment.count({
          where: { driverId: id, unassignedAt: null },
        });
        if (activeAssignments > 0) {
          throw new BadRequestException('Cannot change client while driver has active vehicle assignments');
        }
      }
      resolvedClientId = client.id;
    }

    const row = await this.prisma.driver.update({
      where: { id },
      data: {
        ...(resolvedClientId !== undefined ? { clientId: resolvedClientId } : {}),
        ...(input.fullName !== undefined ? { fullName: input.fullName.trim() || existing.fullName } : {}),
        ...(input.employeeCode !== undefined
          ? { employeeCode: input.employeeCode?.trim() || null }
          : {}),
        ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
        ...(input.email !== undefined ? { email: input.email?.trim() || null } : {}),
        ...(input.licenseNumber !== undefined
          ? { licenseNumber: input.licenseNumber?.trim() || null }
          : {}),
        ...(input.licenseCategories !== undefined
          ? { licenseCategories: input.licenseCategories?.trim() || null }
          : {}),
        ...(input.licenseExpiresOn !== undefined
          ? { licenseExpiresOn: parseOptionalDate(input.licenseExpiresOn) }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      },
      include: {
        client: { select: { code: true, legalName: true } },
        vehicleAssignments: {
          where: { unassignedAt: null },
          include: { vehicle: { select: { id: true, registrationNumber: true } } },
        },
      },
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'driver.update',
      entityType: 'driver',
      entityId: row.id,
      meta: { fullName: row.fullName },
    });

    return this.toRecord(row);
  }

  async delete(tenantSlug: string, id: string, actorUserId?: string, access?: AccessContext): Promise<void> {
    await assertDriverOpsWrite(this.prisma, tenantSlug, id, access);
    const tenant = await this.ensureTenant(tenantSlug);
    const existing = await this.findDriverRow(tenantSlug, id);
    const active = await this.prisma.driverVehicleAssignment.count({
      where: { driverId: id, unassignedAt: null },
    });
    if (active > 0) {
      throw new BadRequestException('Cannot delete driver with active vehicle assignments');
    }

    await this.prisma.driver.delete({ where: { id } });
    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'driver.delete',
      entityType: 'driver',
      entityId: id,
      meta: { fullName: existing.fullName },
    });
  }

  async createAssignment(
    tenantSlug: string,
    driverId: string,
    input: CreateAssignmentInput,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<DriverAssignmentRecord> {
    await assertDriverOpsWrite(this.prisma, tenantSlug, driverId, access);
    await assertVehicleOpsWrite(this.prisma, tenantSlug, input.vehicleId, access);
    const tenant = await this.ensureTenant(tenantSlug);
    const driver = await this.findDriverRow(tenantSlug, driverId);

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: input.vehicleId, tenantId: tenant.id },
    });
    if (!vehicle) throw new BadRequestException('vehicleId invalid');
    if (vehicle.clientId !== driver.clientId) {
      throw new BadRequestException('Vehicle must belong to the same client as the driver');
    }

    const assignedAt = input.assignedAt ? parseRequiredDate(input.assignedAt) : new Date();
    const now = assignedAt;

    await this.prisma.$transaction(async (tx) => {
      await tx.driverVehicleAssignment.updateMany({
        where: { vehicleId: vehicle.id, unassignedAt: null },
        data: { unassignedAt: now },
      });

      await tx.driverVehicleAssignment.create({
        data: {
          tenantId: tenant.id,
          driverId: driver.id,
          vehicleId: vehicle.id,
          assignedAt: now,
          assignedByUserId: actorUserId ?? null,
          notes: input.notes?.trim() || null,
        },
      });
    });

    const created = await this.prisma.driverVehicleAssignment.findFirst({
      where: { driverId, vehicleId: vehicle.id, unassignedAt: null },
      include: {
        vehicle: { select: { registrationNumber: true } },
        assignedBy: { select: { email: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });
    if (!created) throw new BadRequestException('Assignment failed');

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'driver_assignment.create',
      entityType: 'driver_vehicle_assignment',
      entityId: created.id,
      meta: {
        driverId,
        vehicleId: vehicle.id,
        registrationNumber: vehicle.registrationNumber,
      },
    });

    return this.toAssignmentRecord(created);
  }

  async endAssignment(
    tenantSlug: string,
    driverId: string,
    assignmentId: string,
    actorUserId?: string,
  ): Promise<DriverAssignmentRecord> {
    const tenant = await this.ensureTenant(tenantSlug);
    await this.findDriverRow(tenantSlug, driverId);

    const existing = await this.prisma.driverVehicleAssignment.findFirst({
      where: { id: assignmentId, driverId },
      include: {
        vehicle: { select: { registrationNumber: true } },
        assignedBy: { select: { email: true } },
      },
    });
    if (!existing) throw new NotFoundException('Assignment not found');
    if (existing.unassignedAt) {
      return this.toAssignmentRecord(existing);
    }

    const row = await this.prisma.driverVehicleAssignment.update({
      where: { id: assignmentId },
      data: { unassignedAt: new Date() },
      include: {
        vehicle: { select: { registrationNumber: true } },
        assignedBy: { select: { email: true } },
      },
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'driver_assignment.end',
      entityType: 'driver_vehicle_assignment',
      entityId: row.id,
      meta: { driverId, vehicleId: row.vehicleId },
    });

    return this.toAssignmentRecord(row);
  }

  private listWhere(
    tenantId: string,
    params: {
      q?: string;
      clientId?: string;
      status?: DriverStatus;
      licenseExpiry?: 'expiring' | 'expired';
    },
    access?: AccessContext,
  ): Prisma.DriverWhereInput {
    const parts: Prisma.DriverWhereInput[] = [{ tenantId }];
    if (access) {
      parts.push(driverClientScope(access));
    }
    if (params.status) parts.push({ status: params.status });
    if (params.clientId) parts.push({ clientId: params.clientId });
    if (params.licenseExpiry) {
      const window = licenseExpiryWhere(params.licenseExpiry);
      parts.push({
        licenseExpiresOn: {
          not: null,
          ...(window.lt ? { lt: window.lt } : {}),
          ...(window.gte ? { gte: window.gte } : {}),
          ...(window.lte ? { lte: window.lte } : {}),
        },
      });
    }
    const q = params.q?.trim();
    if (q) {
      parts.push({
        OR: [
          { fullName: { contains: q, mode: 'insensitive' } },
          { employeeCode: { contains: q, mode: 'insensitive' } },
          { licenseNumber: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      });
    }
    return { AND: parts };
  }

  private async ensureTenant(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  private async findDriverRow(tenantSlug: string, id: string) {
    const row = await this.prisma.driver.findFirst({
      where: { id, tenant: { slug: tenantSlug } },
      include: {
        client: { select: { code: true, legalName: true } },
        vehicleAssignments: {
          where: { unassignedAt: null },
          include: { vehicle: { select: { id: true, registrationNumber: true } } },
        },
      },
    });
    if (!row) throw new NotFoundException('Driver not found');
    return row;
  }

  private toRecord(row: {
    id: string;
    clientId: string;
    fullName: string;
    employeeCode: string | null;
    phone: string | null;
    email: string | null;
    licenseNumber: string | null;
    licenseCategories: string | null;
    licenseExpiresOn: Date | null;
    status: DriverStatus;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    client: { code: string; legalName: string };
    vehicleAssignments: Array<{
      vehicle: { id: string; registrationNumber: string };
    }>;
  }): DriverRecord {
    return {
      id: row.id,
      clientId: row.clientId,
      clientCode: row.client.code,
      clientLegalName: row.client.legalName,
      fullName: row.fullName,
      employeeCode: row.employeeCode,
      phone: row.phone,
      email: row.email,
      licenseNumber: row.licenseNumber,
      licenseCategories: row.licenseCategories,
      licenseExpiresOn: row.licenseExpiresOn ? row.licenseExpiresOn.toISOString() : null,
      licenseExpiryStatus: licenseExpiryStatus(row.licenseExpiresOn),
      status: row.status,
      notes: row.notes,
      activeVehicleIds: row.vehicleAssignments.map((a) => a.vehicle.id),
      activeVehicleRegistrations: row.vehicleAssignments.map((a) => a.vehicle.registrationNumber),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toAssignmentRecord(row: {
    id: string;
    driverId: string;
    vehicleId: string;
    assignedAt: Date;
    unassignedAt: Date | null;
    assignedByUserId: string | null;
    notes: string | null;
    vehicle: { registrationNumber: string };
    driver?: { fullName: string } | null;
    assignedBy: { email: string } | null;
  }): DriverAssignmentRecord {
    return {
      id: row.id,
      driverId: row.driverId,
      driverFullName: row.driver?.fullName ?? null,
      vehicleId: row.vehicleId,
      registrationNumber: row.vehicle.registrationNumber,
      assignedAt: row.assignedAt.toISOString(),
      unassignedAt: row.unassignedAt ? row.unassignedAt.toISOString() : null,
      assignedByUserId: row.assignedByUserId,
      assignedByEmail: row.assignedBy?.email ?? null,
      notes: row.notes,
    };
  }
}

function parseOptionalDate(raw: string | null | undefined): Date | null {
  if (!raw?.trim()) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new BadRequestException('licenseExpiresOn invalid');
  return d;
}

function parseRequiredDate(raw: string): Date {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new BadRequestException('assignedAt invalid');
  return d;
}
