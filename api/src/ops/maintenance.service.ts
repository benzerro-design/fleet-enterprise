import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { assertVehicleInTenant } from './ops-scope';
import { escapeCsvCell, MAX_EXPORT_ROWS } from './ops-csv';
import type { MaintenanceCostAllocationCode } from './maintenance-cost-allocation';

const MAX_PAGE_SIZE = 200;

export type CreateMaintenanceInput = {
  vehicleId: string;
  title: string;
  provider?: string | null;
  /** Cod predefinit (revizie, reparatie_mecanica, …). Obligatoriu la creare. */
  costAllocationCode: MaintenanceCostAllocationCode;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  invoiceAttachmentUrl?: string | null;
  performedAt?: string | null;
  odometerKm?: number | null;
  notes?: string | null;
  costCents?: number | null;
};

export type PatchMaintenanceInput = Partial<CreateMaintenanceInput>;

export type MaintenanceBrowseFilters = {
  /** Număr înmatriculare (tenant, case-insensitive). */
  registrationNumber?: string;
  clientId?: string;
  provider?: string;
  q?: string;
  performedFrom?: string;
  performedTo?: string;
};

export type MaintenanceListParams = MaintenanceBrowseFilters & {
  page: number;
  pageSize: number;
};

function parseDayStart(s: string): Date {
  const t = s.trim();
  if (t.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return new Date(`${t}T00:00:00.000Z`);
  }
  return new Date(t);
}

function parseDayEnd(s: string): Date {
  const t = s.trim();
  if (t.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return new Date(`${t}T23:59:59.999Z`);
  }
  return new Date(t);
}

function maintenanceWhere(tenantId: string, f: MaintenanceBrowseFilters): Prisma.MaintenanceEntryWhereInput {
  const parts: Prisma.MaintenanceEntryWhereInput[] = [{ tenantId }];
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
  if (f.provider?.trim()) {
    parts.push({ provider: { equals: f.provider.trim(), mode: 'insensitive' } });
  }
  if (f.q?.trim()) {
    const q = f.q.trim();
    parts.push({
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { provider: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
      ],
    });
  }
  if (f.performedFrom?.trim()) {
    parts.push({ performedAt: { gte: parseDayStart(f.performedFrom) } });
  }
  if (f.performedTo?.trim()) {
    parts.push({ performedAt: { lte: parseDayEnd(f.performedTo) } });
  }
  return { AND: parts };
}

function maintPatchFieldKeys(
  before: {
    vehicleId: string;
    title: string;
    provider: string | null;
    costAllocationCode: string | null;
    invoiceNumber: string | null;
    invoiceDate: Date | null;
    invoiceAttachmentUrl: string | null;
    performedAt: Date | null;
    odometerKm: number | null;
    notes: string | null;
    costCents: number | null;
  },
  dto: PatchMaintenanceInput,
): string[] {
  const keys: string[] = [];
  if (dto.vehicleId !== undefined && dto.vehicleId !== before.vehicleId) keys.push('vehicleId');
  if (dto.title !== undefined && dto.title !== before.title) keys.push('title');
  if (dto.provider !== undefined && dto.provider !== before.provider) keys.push('provider');
  if (dto.costAllocationCode !== undefined && dto.costAllocationCode !== before.costAllocationCode) {
    keys.push('costAllocationCode');
  }
  if (dto.invoiceNumber !== undefined && dto.invoiceNumber !== before.invoiceNumber) {
    keys.push('invoiceNumber');
  }
  if (dto.invoiceDate !== undefined) {
    const next = dto.invoiceDate ? new Date(dto.invoiceDate) : null;
    const prev = before.invoiceDate;
    const prevMs = prev ? prev.getTime() : null;
    const nextMs = next ? next.getTime() : null;
    if (prevMs !== nextMs) keys.push('invoiceDate');
  }
  if (
    dto.invoiceAttachmentUrl !== undefined &&
    dto.invoiceAttachmentUrl !== before.invoiceAttachmentUrl
  ) {
    keys.push('invoiceAttachmentUrl');
  }
  if (dto.performedAt !== undefined) {
    const next = dto.performedAt ? new Date(dto.performedAt) : null;
    const prev = before.performedAt;
    const prevMs = prev ? prev.getTime() : null;
    const nextMs = next ? next.getTime() : null;
    if (prevMs !== nextMs) keys.push('performedAt');
  }
  if (dto.odometerKm !== undefined && dto.odometerKm !== before.odometerKm) keys.push('odometerKm');
  if (dto.notes !== undefined && dto.notes !== before.notes) keys.push('notes');
  if (dto.costCents !== undefined && dto.costCents !== before.costCents) keys.push('costCents');
  return keys;
}

function toMaintRow(row: {
  id: string;
  vehicleId: string;
  title: string;
  provider: string | null;
  costAllocationCode: string | null;
  invoiceNumber: string | null;
  invoiceDate: Date | null;
  invoiceAttachmentUrl: string | null;
  performedAt: Date | null;
  odometerKm: number | null;
  notes: string | null;
  costCents: number | null;
  vehicle: { registrationNumber: string; clientId: string };
  tenant: { slug: string };
}) {
  return {
    id: row.id,
    tenantSlug: row.tenant.slug,
    vehicleId: row.vehicleId,
    registrationNumber: row.vehicle.registrationNumber,
    clientId: row.vehicle.clientId,
    title: row.title,
    provider: row.provider,
    costAllocationCode: row.costAllocationCode,
    invoiceNumber: row.invoiceNumber,
    invoiceDate: row.invoiceDate ? row.invoiceDate.toISOString() : null,
    invoiceAttachmentUrl: row.invoiceAttachmentUrl,
    performedAt: row.performedAt ? row.performedAt.toISOString() : null,
    odometerKm: row.odometerKm,
    notes: row.notes,
    costCents: row.costCents,
  };
}

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantSlug: string, params: MaintenanceListParams) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return { items: [], total: 0, page: params.page, pageSize: params.pageSize };
    }
    const pageSize = Math.min(Math.max(1, params.pageSize), MAX_PAGE_SIZE);
    const page = Math.max(1, params.page);
    const skip = (page - 1) * pageSize;

    const where = maintenanceWhere(tenant.id, {
      registrationNumber: params.registrationNumber,
      clientId: params.clientId,
      provider: params.provider,
      q: params.q,
      performedFrom: params.performedFrom,
      performedTo: params.performedTo,
    });

    const [total, rows] = await Promise.all([
      this.prisma.maintenanceEntry.count({ where }),
      this.prisma.maintenanceEntry.findMany({
        where,
        include: {
          vehicle: { select: { registrationNumber: true, clientId: true } },
          tenant: { select: { slug: true } },
        },
        orderBy: { id: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map(toMaintRow),
      total,
      page,
      pageSize,
    };
  }

  async exportCsv(tenantSlug: string, filters: MaintenanceBrowseFilters): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return '\uFEFFid,vehicleId,registrationNumber,clientId,title,provider,costAllocationCode,invoiceNumber,invoiceDate,invoiceAttachmentUrl,performedAt,odometerKm,costCents,notes\n';
    }
    const where = maintenanceWhere(tenant.id, filters);
    const rows = await this.prisma.maintenanceEntry.findMany({
      where,
      orderBy: { id: 'desc' },
      take: MAX_EXPORT_ROWS,
      include: { vehicle: { select: { registrationNumber: true, clientId: true } } },
    });
    const header =
      'id,vehicleId,registrationNumber,clientId,title,provider,costAllocationCode,invoiceNumber,invoiceDate,invoiceAttachmentUrl,performedAt,odometerKm,costCents,notes';
    const lines = rows.map((r) =>
      [
        r.id,
        r.vehicleId,
        r.vehicle.registrationNumber,
        r.vehicle.clientId,
        r.title,
        r.provider ?? '',
        r.costAllocationCode ?? '',
        r.invoiceNumber ?? '',
        r.invoiceDate ? r.invoiceDate.toISOString() : '',
        r.invoiceAttachmentUrl ?? '',
        r.performedAt ? r.performedAt.toISOString() : '',
        r.odometerKm != null ? String(r.odometerKm) : '',
        r.costCents != null ? String(r.costCents) : '',
        r.notes ?? '',
      ]
        .map((c) => escapeCsvCell(c))
        .join(','),
    );
    return `\uFEFF${header}\n${lines.join('\n')}\n`;
  }

  async getById(tenantSlug: string, id: string) {
    const row = await this.prisma.maintenanceEntry.findFirst({
      where: { id, tenant: { slug: tenantSlug } },
      include: {
        vehicle: { select: { registrationNumber: true, clientId: true } },
        tenant: { select: { slug: true } },
      },
    });
    if (!row) throw new NotFoundException('Maintenance entry not found');
    return toMaintRow(row);
  }

  async create(tenantSlug: string, dto: CreateMaintenanceInput, actorUserId?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    await assertVehicleInTenant(this.prisma, tenantSlug, dto.vehicleId);

    const row = await this.prisma.maintenanceEntry.create({
      data: {
        tenantId: tenant.id,
        vehicleId: dto.vehicleId,
        title: dto.title,
        provider: dto.provider ?? null,
        costAllocationCode: dto.costAllocationCode,
        invoiceNumber: dto.invoiceNumber ?? null,
        invoiceDate:
          dto.invoiceDate === undefined ? null : dto.invoiceDate ? new Date(dto.invoiceDate) : null,
        invoiceAttachmentUrl: dto.invoiceAttachmentUrl ?? null,
        performedAt:
          dto.performedAt === undefined ? null : dto.performedAt ? new Date(dto.performedAt) : null,
        odometerKm: dto.odometerKm ?? null,
        notes: dto.notes ?? null,
        costCents: dto.costCents ?? null,
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
      entityType: 'maintenance_entry',
      entityId: row.id,
      meta: {
        registrationNumber: row.vehicle.registrationNumber,
        clientId: row.vehicle.clientId,
        title: row.title,
        provider: row.provider,
        vehicleId: row.vehicleId,
        costAllocationCode: row.costAllocationCode,
        invoiceNumber: row.invoiceNumber,
      },
    });

    return toMaintRow(row);
  }

  async patch(tenantSlug: string, id: string, dto: PatchMaintenanceInput, actorUserId?: string) {
    if (dto.vehicleId) {
      await assertVehicleInTenant(this.prisma, tenantSlug, dto.vehicleId);
    }

    const before = await this.prisma.maintenanceEntry.findFirst({
      where: { id, tenant: { slug: tenantSlug } },
      include: { vehicle: { select: { registrationNumber: true, clientId: true } } },
    });
    if (!before) throw new NotFoundException('Maintenance entry not found');

    const data: Prisma.MaintenanceEntryUncheckedUpdateManyInput = {
      vehicleId: dto.vehicleId,
      title: dto.title,
      provider: dto.provider,
      costAllocationCode: dto.costAllocationCode,
      invoiceNumber: dto.invoiceNumber,
      invoiceDate:
        dto.invoiceDate === undefined ? undefined : dto.invoiceDate === null ? null : new Date(dto.invoiceDate),
      invoiceAttachmentUrl: dto.invoiceAttachmentUrl,
      performedAt:
        dto.performedAt === undefined
          ? undefined
          : dto.performedAt === null
            ? null
            : new Date(dto.performedAt),
      odometerKm: dto.odometerKm,
      notes: dto.notes,
      costCents: dto.costCents,
    };

    const r = await this.prisma.maintenanceEntry.updateMany({
      where: { id, tenant: { slug: tenantSlug } },
      data,
    });
    if (r.count === 0) throw new NotFoundException('Maintenance entry not found');

    const fields = maintPatchFieldKeys(
      {
        vehicleId: before.vehicleId,
        title: before.title,
        provider: before.provider,
        costAllocationCode: before.costAllocationCode,
        invoiceNumber: before.invoiceNumber,
        invoiceDate: before.invoiceDate,
        invoiceAttachmentUrl: before.invoiceAttachmentUrl,
        performedAt: before.performedAt,
        odometerKm: before.odometerKm,
        notes: before.notes,
        costCents: before.costCents,
      },
      dto,
    );

    await this.audit.log({
      tenantId: before.tenantId,
      actorUserId: actorUserId ?? undefined,
      action: 'update',
      entityType: 'maintenance_entry',
      entityId: id,
      meta: {
        registrationNumber: before.vehicle.registrationNumber,
        clientId: before.vehicle.clientId,
        title: before.title,
        provider: before.provider,
        fields,
        invoiceNumber: before.invoiceNumber,
      },
    });

    return this.getById(tenantSlug, id);
  }

  async delete(tenantSlug: string, id: string, actorUserId?: string) {
    const row = await this.prisma.maintenanceEntry.findFirst({
      where: { id, tenant: { slug: tenantSlug } },
      include: { vehicle: { select: { registrationNumber: true, clientId: true } } },
    });
    if (!row) throw new NotFoundException('Maintenance entry not found');

    await this.audit.log({
      tenantId: row.tenantId,
      actorUserId: actorUserId ?? undefined,
      action: 'delete',
      entityType: 'maintenance_entry',
      entityId: id,
      meta: {
        registrationNumber: row.vehicle.registrationNumber,
        clientId: row.vehicle.clientId,
        title: row.title,
        provider: row.provider,
        costAllocationCode: row.costAllocationCode,
        invoiceNumber: row.invoiceNumber,
      },
    });

    await this.prisma.maintenanceEntry.deleteMany({
      where: { id, tenant: { slug: tenantSlug } },
    });
  }
}
