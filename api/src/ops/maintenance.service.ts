import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeReminderOffsets } from './document-reminders';
import { normalizeReminderOffsetsKm } from './reminder-status';
import { isItpMaintenanceAllocation, syncItpCertDocument, syncVehicleItpFromOps } from './itp-sync';
import { resolveOptionalClientVehicleFilter } from '../clients/client-resolve';
import type { AccessContext } from '../iam/access-context.types';
import { driverOnlyEmptyPage, mergeVehicleLinkedScope } from './ops-client-scope';
import { assertMaintenanceOpsWrite, assertVehicleOpsWrite } from './ops-write-access';
import { assertVehicleInTenant } from './ops-scope';
import { rejectOpsEntryVehicleIdChange } from './ops-patch-guards';
import { escapeCsvCell, MAX_EXPORT_ROWS } from './ops-csv';
import type { MaintenanceCostAllocationCode } from './maintenance-cost-allocation';
import { RemindersService } from './reminders.service';
import { VehicleOdometerSyncService } from './vehicle-odometer-sync.service';
import {
  reminderMenuSyncEnabledForCreate,
  reminderMenuSyncEnabledPatchValue,
  shouldRunReminderMenuSync,
} from './reminder-sync';

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
  warrantyRepair?: boolean;
  potentialCostCents?: number | null;
  damageClaimFileNumber?: string | null;
  insurerName?: string | null;
  nextDueOn?: string | null;
  reminderOffsetsDays?: number[] | null;
  dueOdometerKm?: number | null;
  reminderOffsetsKm?: number[] | null;
  syncReminderAction?: boolean;
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

async function maintenanceWhere(
  prisma: PrismaService,
  tenantId: string,
  f: MaintenanceBrowseFilters,
  access?: AccessContext,
): Promise<Prisma.MaintenanceEntryWhereInput> {
  const parts: Prisma.MaintenanceEntryWhereInput[] = [{ tenantId }];
  mergeVehicleLinkedScope(parts, access);
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
    warrantyRepair: boolean;
    potentialCostCents: number | null;
    damageClaimFileNumber: string | null;
    insurerName: string | null;
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
  if (dto.warrantyRepair !== undefined && dto.warrantyRepair !== before.warrantyRepair) {
    keys.push('warrantyRepair');
  }
  if (dto.potentialCostCents !== undefined && dto.potentialCostCents !== before.potentialCostCents) {
    keys.push('potentialCostCents');
  }
  if (dto.damageClaimFileNumber !== undefined && dto.damageClaimFileNumber !== before.damageClaimFileNumber) {
    keys.push('damageClaimFileNumber');
  }
  if (dto.insurerName !== undefined && dto.insurerName !== before.insurerName) {
    keys.push('insurerName');
  }
  return keys;
}

function reminderOffsetsForDb(
  value: number[] | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  return value;
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
  warrantyRepair: boolean;
  potentialCostCents: number | null;
  damageClaimFileNumber: string | null;
  insurerName: string | null;
  nextDueOn: Date | null;
  reminderOffsetsDays: unknown;
  dueOdometerKm: number | null;
  reminderOffsetsKm: unknown;
  reminderMenuSyncEnabled: boolean;
  vehicle: { registrationNumber: string; client: { code: string } };
  tenant: { slug: string };
}) {
  return {
    id: row.id,
    tenantSlug: row.tenant.slug,
    vehicleId: row.vehicleId,
    registrationNumber: row.vehicle.registrationNumber,
    clientId: row.vehicle.client.code,
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
    warrantyRepair: row.warrantyRepair,
    potentialCostCents: row.potentialCostCents,
    damageClaimFileNumber: row.damageClaimFileNumber,
    insurerName: row.insurerName,
    nextDueOn: row.nextDueOn ? row.nextDueOn.toISOString() : null,
    reminderOffsetsDays: normalizeReminderOffsets(row.reminderOffsetsDays),
    dueOdometerKm: row.dueOdometerKm,
    reminderOffsetsKm: normalizeReminderOffsetsKm(row.reminderOffsetsKm),
    reminderMenuSyncEnabled: row.reminderMenuSyncEnabled,
  };
}

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly reminders: RemindersService,
    private readonly odometerSync: VehicleOdometerSyncService,
  ) {}

  async list(tenantSlug: string, params: MaintenanceListParams, access?: AccessContext) {
    const empty = driverOnlyEmptyPage(access, params.page, params.pageSize);
    if (empty) return empty;
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return { items: [], total: 0, page: params.page, pageSize: params.pageSize };
    }
    const pageSize = Math.min(Math.max(1, params.pageSize), MAX_PAGE_SIZE);
    const page = Math.max(1, params.page);
    const skip = (page - 1) * pageSize;

    const where = await maintenanceWhere(this.prisma, tenant.id, {
      registrationNumber: params.registrationNumber,
      clientId: params.clientId,
      provider: params.provider,
      q: params.q,
      performedFrom: params.performedFrom,
      performedTo: params.performedTo,
    }, access);

    const [total, rows] = await Promise.all([
      this.prisma.maintenanceEntry.count({ where }),
      this.prisma.maintenanceEntry.findMany({
        where,
        include: {
          vehicle: { select: { registrationNumber: true, client: { select: { code: true } } } },
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

  async exportCsv(tenantSlug: string, filters: MaintenanceBrowseFilters, access?: AccessContext): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return '\uFEFFid,vehicleId,registrationNumber,clientId,title,provider,costAllocationCode,invoiceNumber,invoiceDate,invoiceAttachmentUrl,performedAt,odometerKm,costCents,notes\n';
    }
    const where = await maintenanceWhere(this.prisma, tenant.id, filters, access);
    const rows = await this.prisma.maintenanceEntry.findMany({
      where,
      orderBy: { id: 'desc' },
      take: MAX_EXPORT_ROWS,
      include: { vehicle: { select: { registrationNumber: true, client: { select: { code: true } } } } },
    });
    const header =
      'id,vehicleId,registrationNumber,clientId,title,provider,costAllocationCode,invoiceNumber,invoiceDate,invoiceAttachmentUrl,performedAt,odometerKm,costCents,notes';
    const lines = rows.map((r) =>
      [
        r.id,
        r.vehicleId,
        r.vehicle.registrationNumber,
        r.vehicle.client.code,
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

  async getById(tenantSlug: string, id: string, access?: AccessContext) {
    const clientFilter =
      access && !access.isTenantWide
        ? { vehicle: { clientId: { in: access.allowedClientIds } } }
        : {};
    const row = await this.prisma.maintenanceEntry.findFirst({
      where: { id, tenant: { slug: tenantSlug }, ...clientFilter },
      include: {
        vehicle: { select: { registrationNumber: true, client: { select: { code: true } } } },
        tenant: { select: { slug: true } },
      },
    });
    if (!row) throw new NotFoundException('Maintenance entry not found');
    return toMaintRow(row);
  }

  async create(tenantSlug: string, dto: CreateMaintenanceInput, actorUserId?: string, access?: AccessContext) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    await assertVehicleOpsWrite(this.prisma, tenantSlug, dto.vehicleId, access);
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
        costCents: dto.warrantyRepair ? 0 : (dto.costCents ?? null),
        warrantyRepair: dto.warrantyRepair ?? false,
        potentialCostCents: dto.warrantyRepair ? (dto.potentialCostCents ?? null) : null,
        damageClaimFileNumber:
          dto.costAllocationCode === 'dauna' ? (dto.damageClaimFileNumber?.trim() || null) : null,
        insurerName: dto.costAllocationCode === 'dauna' ? (dto.insurerName?.trim() || null) : null,
        nextDueOn:
          dto.nextDueOn === undefined ? null : dto.nextDueOn ? new Date(dto.nextDueOn) : null,
        reminderOffsetsDays: reminderOffsetsForDb(dto.reminderOffsetsDays),
        dueOdometerKm: dto.dueOdometerKm ?? null,
        reminderOffsetsKm: reminderOffsetsForDb(dto.reminderOffsetsKm),
        reminderMenuSyncEnabled: reminderMenuSyncEnabledForCreate(dto.syncReminderAction),
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
      entityType: 'maintenance_entry',
      entityId: row.id,
      meta: {
        registrationNumber: row.vehicle.registrationNumber,
        clientId: row.vehicle.client.code,
        title: row.title,
        provider: row.provider,
        vehicleId: row.vehicleId,
        costAllocationCode: row.costAllocationCode,
        invoiceNumber: row.invoiceNumber,
      },
    });

    let reminderSyncFailed = false;
    reminderSyncFailed = await this.applyMaintenanceReminderMenuSync(tenant.id, row, dto.syncReminderAction);

    if (isItpMaintenanceAllocation(row.costAllocationCode) && row.nextDueOn) {
      try {
        await syncVehicleItpFromOps(this.prisma, row.vehicleId, row.nextDueOn, row.provider);
        await syncItpCertDocument(this.prisma, row.vehicleId, row.nextDueOn);
      } catch (err) {
        console.error('syncVehicleItpFromOps after maintenance create failed', err);
      }
    }

    const vehicleOdometerSync = await this.odometerSync.syncFromOps({
      tenantId: tenant.id,
      vehicleId: row.vehicleId,
      registrationNumber: row.vehicle.registrationNumber,
      odometerKm: row.odometerKm,
      recordedAt: row.performedAt ?? new Date(),
      entity: 'maintenance',
      entityId: row.id,
      entityLabel: `mentenanță (${row.title})`,
      actorUserId,
    });

    return { ...toMaintRow(row), reminderSyncFailed, vehicleOdometerSync };
  }

  async patch(tenantSlug: string, id: string, dto: PatchMaintenanceInput, actorUserId?: string, access?: AccessContext) {
    await assertMaintenanceOpsWrite(this.prisma, tenantSlug, id, access);
    if (dto.vehicleId) {
      await assertVehicleOpsWrite(this.prisma, tenantSlug, dto.vehicleId, access);
    }
    const before = await this.prisma.maintenanceEntry.findFirst({
      where: { id, tenant: { slug: tenantSlug } },
      include: { vehicle: { select: { registrationNumber: true, client: { select: { code: true } } } } },
    });
    if (!before) throw new NotFoundException('Maintenance entry not found');

    rejectOpsEntryVehicleIdChange(dto.vehicleId, before.vehicleId);

    const effectiveAlloc = dto.costAllocationCode ?? before.costAllocationCode;
    const isDauna = effectiveAlloc === 'dauna';
    const daunaStringField = (value: string | null | undefined): string | null | undefined => {
      if (value === undefined) {
        if (dto.costAllocationCode !== undefined && !isDauna) return null;
        return undefined;
      }
      if (!isDauna) return null;
      return value === null ? null : value.trim() || null;
    };

    const data: Prisma.MaintenanceEntryUncheckedUpdateManyInput = {
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
      costCents:
        dto.warrantyRepair === true
          ? 0
          : dto.warrantyRepair === false && dto.costCents === undefined
            ? undefined
            : dto.costCents,
      warrantyRepair: dto.warrantyRepair,
      potentialCostCents:
        dto.warrantyRepair === true
          ? (dto.potentialCostCents ?? null)
          : dto.warrantyRepair === false
            ? null
            : dto.potentialCostCents,
      damageClaimFileNumber: daunaStringField(dto.damageClaimFileNumber),
      insurerName: daunaStringField(dto.insurerName),
      nextDueOn:
        dto.nextDueOn === undefined
          ? undefined
          : dto.nextDueOn === null
            ? null
            : new Date(dto.nextDueOn),
      reminderOffsetsDays: reminderOffsetsForDb(dto.reminderOffsetsDays),
      dueOdometerKm: dto.dueOdometerKm,
      reminderOffsetsKm: reminderOffsetsForDb(dto.reminderOffsetsKm),
      reminderMenuSyncEnabled: reminderMenuSyncEnabledPatchValue(dto.syncReminderAction),
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
        warrantyRepair: before.warrantyRepair,
        potentialCostCents: before.potentialCostCents,
        damageClaimFileNumber: before.damageClaimFileNumber,
        insurerName: before.insurerName,
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
        clientId: before.vehicle.client.code,
        title: before.title,
        provider: before.provider,
        fields,
        invoiceNumber: before.invoiceNumber,
      },
    });

    const updated = await this.getById(tenantSlug, id);

    let reminderSyncFailed = false;
    reminderSyncFailed = await this.applyMaintenanceReminderMenuSync(
      before.tenantId,
      {
        id: updated.id,
        vehicleId: updated.vehicleId,
        title: updated.title,
        nextDueOn: updated.nextDueOn ? new Date(updated.nextDueOn) : null,
        reminderOffsetsDays: updated.reminderOffsetsDays,
        dueOdometerKm: updated.dueOdometerKm,
        reminderOffsetsKm: updated.reminderOffsetsKm,
        reminderMenuSyncEnabled: updated.reminderMenuSyncEnabled,
      },
      dto.syncReminderAction,
    );

    if (isItpMaintenanceAllocation(updated.costAllocationCode) && updated.nextDueOn) {
      try {
        await syncVehicleItpFromOps(
          this.prisma,
          updated.vehicleId,
          new Date(updated.nextDueOn),
          updated.provider,
        );
        await syncItpCertDocument(this.prisma, updated.vehicleId, new Date(updated.nextDueOn));
      } catch (err) {
        console.error('syncVehicleItpFromOps after maintenance patch failed', err);
      }
    }

    const vehicleOdometerSync =
      dto.odometerKm !== undefined
        ? await this.odometerSync.syncFromOps({
            tenantId: before.tenantId,
            vehicleId: updated.vehicleId,
            registrationNumber: before.vehicle.registrationNumber,
            odometerKm: updated.odometerKm,
            recordedAt: updated.performedAt ? new Date(updated.performedAt) : new Date(),
            entity: 'maintenance',
            entityId: updated.id,
            entityLabel: `mentenanță (${updated.title})`,
            actorUserId,
          })
        : null;

    return { ...updated, reminderSyncFailed, vehicleOdometerSync };
  }

  private async applyMaintenanceReminderMenuSync(
    tenantId: string,
    row: {
      id: string;
      vehicleId: string;
      title: string;
      nextDueOn: Date | null;
      reminderOffsetsDays: unknown;
      dueOdometerKm: number | null;
      reminderOffsetsKm: unknown;
      reminderMenuSyncEnabled: boolean;
    },
    syncReminderAction?: boolean,
  ): Promise<boolean> {
    if (shouldRunReminderMenuSync(row.reminderMenuSyncEnabled, syncReminderAction)) {
      try {
        await this.reminders.syncFromMaintenance(tenantId, {
          id: row.id,
          vehicleId: row.vehicleId,
          title: row.title,
          nextDueOn: row.nextDueOn,
          reminderOffsetsDays: row.reminderOffsetsDays,
          dueOdometerKm: row.dueOdometerKm,
          reminderOffsetsKm: row.reminderOffsetsKm,
        });
        return false;
      } catch (err) {
        console.error('syncFromMaintenance failed', err);
        return true;
      }
    }
    try {
      await this.prisma.reminderAction.deleteMany({ where: { maintenanceEntryId: row.id } });
    } catch (err) {
      console.error('delete maintenance reminder failed', err);
    }
    return false;
  }

  async delete(tenantSlug: string, id: string, actorUserId?: string, access?: AccessContext) {
    await assertMaintenanceOpsWrite(this.prisma, tenantSlug, id, access);
    const row = await this.prisma.maintenanceEntry.findFirst({
      where: { id, tenant: { slug: tenantSlug } },
      include: { vehicle: { select: { registrationNumber: true, client: { select: { code: true } } } } },
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
        clientId: row.vehicle.client.code,
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
