import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeReminderOffsets } from './document-reminders';
import { normalizeReminderOffsetsKm } from './reminder-status';
import { isItpCostCategory, syncItpCertDocument, syncVehicleItpFromOps } from './itp-sync';
import { isFuelCostCategory } from './fuel-ops';
import { normalizeFuelProductType } from './fuel-types';
import { resolveOptionalClientVehicleFilter } from '../clients/client-resolve';
import { assertVehicleInTenant } from './ops-scope';
import { rejectOpsEntryVehicleIdChange } from './ops-patch-guards';
import { escapeCsvCell, MAX_EXPORT_ROWS } from './ops-csv';
import { RemindersService } from './reminders.service';
import {
  reminderMenuSyncEnabledForCreate,
  reminderMenuSyncEnabledPatchValue,
  shouldRunReminderMenuSync,
} from './reminder-sync';

const MAX_PAGE_SIZE = 200;

export type CreateCostInput = {
  vehicleId: string;
  category: string;
  provider?: string | null;
  amountCents: number;
  fuelLiters?: number | null;
  fuelProductType?: 'diesel' | 'petrol' | 'hybrid' | 'electric' | 'lpg' | null;
  odometerKm?: number | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  invoiceAttachmentUrl?: string | null;
  incurredOn?: string;
  notes?: string | null;
  nextDueOn?: string | null;
  reminderOffsetsDays?: number[] | null;
  dueOdometerKm?: number | null;
  reminderOffsetsKm?: number[] | null;
  syncReminderAction?: boolean;
};

export type PatchCostInput = Partial<CreateCostInput>;

export type CostBrowseFilters = {
  /** Număr înmatriculare (tenant, case-insensitive). */
  registrationNumber?: string;
  clientId?: string;
  category?: string;
  provider?: string;
  q?: string;
  incurredFrom?: string;
  incurredTo?: string;
};

export type CostListParams = CostBrowseFilters & {
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

async function costWhere(
  prisma: PrismaService,
  tenantId: string,
  f: CostBrowseFilters,
): Promise<Prisma.CostEntryWhereInput> {
  const parts: Prisma.CostEntryWhereInput[] = [{ tenantId }];
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
  if (f.category?.trim()) {
    parts.push({ category: f.category.trim() });
  }
  if (f.provider?.trim()) {
    parts.push({ provider: { equals: f.provider.trim(), mode: 'insensitive' } });
  }
  if (f.q?.trim()) {
    const q = f.q.trim();
    parts.push({
      OR: [
        { category: { contains: q, mode: 'insensitive' } },
        { provider: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
      ],
    });
  }
  if (f.incurredFrom?.trim()) {
    parts.push({ incurredOn: { gte: parseDayStart(f.incurredFrom) } });
  }
  if (f.incurredTo?.trim()) {
    parts.push({ incurredOn: { lte: parseDayEnd(f.incurredTo) } });
  }
  return { AND: parts };
}

function costPatchFieldKeys(
  before: {
    vehicleId: string;
    category: string;
    provider: string | null;
    amountCents: number;
    odometerKm: number | null;
    invoiceNumber: string | null;
    invoiceDate: Date | null;
    invoiceAttachmentUrl: string | null;
    incurredOn: Date;
    notes: string | null;
  },
  dto: PatchCostInput,
): string[] {
  const keys: string[] = [];
  if (dto.vehicleId !== undefined && dto.vehicleId !== before.vehicleId) keys.push('vehicleId');
  if (dto.category !== undefined && dto.category.trim() !== before.category) keys.push('category');
  if (dto.provider !== undefined && dto.provider !== before.provider) keys.push('provider');
  if (dto.amountCents !== undefined && Math.round(dto.amountCents) !== before.amountCents) {
    keys.push('amountCents');
  }
  if (dto.odometerKm !== undefined && dto.odometerKm !== before.odometerKm) keys.push('odometerKm');
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
  if (dto.incurredOn !== undefined) {
    const next = new Date(dto.incurredOn);
    if (next.getTime() !== before.incurredOn.getTime()) keys.push('incurredOn');
  }
  if (dto.notes !== undefined && dto.notes !== before.notes) keys.push('notes');
  return keys;
}

function reminderOffsetsForDb(
  value: number[] | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  return value;
}

function normalizeFuelLiters(
  liters: number | null | undefined,
  category: string,
): number | null {
  if (!isFuelCostCategory(category)) return null;
  if (liters === undefined || liters === null) {
    throw new BadRequestException('fuelLiters is required for Combustibil costs');
  }
  if (!Number.isFinite(liters) || liters <= 0) {
    throw new BadRequestException('fuelLiters must be a positive number');
  }
  return Math.round(liters * 100) / 100;
}

function toCostRow(row: {
  id: string;
  vehicleId: string;
  category: string;
  provider: string | null;
  amountCents: number;
  fuelLiters: number | null;
  fuelProductType: string | null;
  odometerKm: number | null;
  invoiceNumber: string | null;
  invoiceDate: Date | null;
  invoiceAttachmentUrl: string | null;
  incurredOn: Date;
  notes: string | null;
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
    category: row.category,
    provider: row.provider,
    amountCents: row.amountCents,
    fuelLiters: row.fuelLiters,
    fuelProductType: row.fuelProductType,
    odometerKm: row.odometerKm,
    invoiceNumber: row.invoiceNumber,
    invoiceDate: row.invoiceDate ? row.invoiceDate.toISOString() : null,
    invoiceAttachmentUrl: row.invoiceAttachmentUrl,
    incurredOn: row.incurredOn.toISOString(),
    notes: row.notes,
    nextDueOn: row.nextDueOn ? row.nextDueOn.toISOString() : null,
    reminderOffsetsDays: normalizeReminderOffsets(row.reminderOffsetsDays),
    dueOdometerKm: row.dueOdometerKm,
    reminderOffsetsKm: normalizeReminderOffsetsKm(row.reminderOffsetsKm),
    reminderMenuSyncEnabled: row.reminderMenuSyncEnabled,
  };
}

@Injectable()
export class CostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly reminders: RemindersService,
  ) {}

  async list(tenantSlug: string, params: CostListParams) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return { items: [], total: 0, page: params.page, pageSize: params.pageSize };
    }
    const pageSize = Math.min(Math.max(1, params.pageSize), MAX_PAGE_SIZE);
    const page = Math.max(1, params.page);
    const skip = (page - 1) * pageSize;

    const where = await costWhere(this.prisma, tenant.id, {
      registrationNumber: params.registrationNumber,
      clientId: params.clientId,
      category: params.category,
      provider: params.provider,
      q: params.q,
      incurredFrom: params.incurredFrom,
      incurredTo: params.incurredTo,
    });

    const [total, rows] = await Promise.all([
      this.prisma.costEntry.count({ where }),
      this.prisma.costEntry.findMany({
        where,
        include: {
          vehicle: { select: { registrationNumber: true, client: { select: { code: true } } } },
          tenant: { select: { slug: true } },
        },
        orderBy: { incurredOn: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map(toCostRow),
      total,
      page,
      pageSize,
    };
  }

  async exportCsv(tenantSlug: string, filters: CostBrowseFilters): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return '\uFEFFid,vehicleId,registrationNumber,clientId,category,provider,amountCents,odometerKm,invoiceNumber,invoiceDate,invoiceAttachmentUrl,incurredOn,notes\n';
    }
    const where = await costWhere(this.prisma, tenant.id, filters);
    const rows = await this.prisma.costEntry.findMany({
      where,
      orderBy: { incurredOn: 'desc' },
      take: MAX_EXPORT_ROWS,
      include: { vehicle: { select: { registrationNumber: true, client: { select: { code: true } } } } },
    });
    const header =
      'id,vehicleId,registrationNumber,clientId,category,provider,amountCents,odometerKm,invoiceNumber,invoiceDate,invoiceAttachmentUrl,incurredOn,notes';
    const lines = rows.map((r) =>
      [
        r.id,
        r.vehicleId,
        r.vehicle.registrationNumber,
        r.vehicle.client.code,
        r.category,
        r.provider ?? '',
        String(r.amountCents),
        r.odometerKm != null ? String(r.odometerKm) : '',
        r.invoiceNumber ?? '',
        r.invoiceDate ? r.invoiceDate.toISOString() : '',
        r.invoiceAttachmentUrl ?? '',
        r.incurredOn.toISOString(),
        r.notes ?? '',
      ]
        .map((c) => escapeCsvCell(c))
        .join(','),
    );
    return `\uFEFF${header}\n${lines.join('\n')}\n`;
  }

  async getById(tenantSlug: string, id: string) {
    const row = await this.prisma.costEntry.findFirst({
      where: { id, tenant: { slug: tenantSlug } },
      include: {
        vehicle: { select: { registrationNumber: true, client: { select: { code: true } } } },
        tenant: { select: { slug: true } },
      },
    });
    if (!row) throw new NotFoundException('Cost entry not found');
    return toCostRow(row);
  }

  async create(tenantSlug: string, dto: CreateCostInput, actorUserId?: string) {
    if (!Number.isFinite(dto.amountCents) || dto.amountCents < 0) {
      throw new BadRequestException('amountCents must be a non-negative integer');
    }
    if (dto.odometerKm !== undefined && dto.odometerKm !== null) {
      if (!Number.isFinite(dto.odometerKm) || dto.odometerKm < 0) {
        throw new BadRequestException('odometerKm must be a non-negative integer');
      }
    }
    const fuelLiters = normalizeFuelLiters(dto.fuelLiters, dto.category);
    const fuelProductType = normalizeFuelProductType(
      dto.fuelProductType ?? undefined,
      dto.category,
      isFuelCostCategory,
    );
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    await assertVehicleInTenant(this.prisma, tenantSlug, dto.vehicleId);

    const row = await this.prisma.costEntry.create({
      data: {
        tenantId: tenant.id,
        vehicleId: dto.vehicleId,
        category: dto.category.trim(),
        provider: dto.provider ?? null,
        amountCents: Math.round(dto.amountCents),
        fuelLiters,
        fuelProductType,
        odometerKm: dto.odometerKm ?? null,
        invoiceNumber: dto.invoiceNumber ?? null,
        invoiceDate:
          dto.invoiceDate === undefined ? null : dto.invoiceDate ? new Date(dto.invoiceDate) : null,
        invoiceAttachmentUrl: dto.invoiceAttachmentUrl ?? null,
        incurredOn: dto.incurredOn ? new Date(dto.incurredOn) : new Date(),
        notes: dto.notes ?? null,
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
      entityType: 'cost_entry',
      entityId: row.id,
      meta: {
        registrationNumber: row.vehicle.registrationNumber,
        clientId: row.vehicle.client.code,
        category: row.category,
        provider: row.provider,
        amountCents: row.amountCents,
        vehicleId: row.vehicleId,
        odometerKm: row.odometerKm,
        invoiceNumber: row.invoiceNumber,
        invoiceDate: row.invoiceDate ? row.invoiceDate.toISOString() : null,
      },
    });

    let reminderSyncFailed = false;
    reminderSyncFailed = await this.applyCostReminderMenuSync(
      tenant.id,
      row,
      `${row.category} — ${row.vehicle.registrationNumber}`,
      dto.syncReminderAction,
    );

    if (isItpCostCategory(row.category) && row.nextDueOn) {
      try {
        await syncVehicleItpFromOps(this.prisma, row.vehicleId, row.nextDueOn, row.provider);
        await syncItpCertDocument(this.prisma, row.vehicleId, row.nextDueOn);
      } catch (err) {
        console.error('syncVehicleItpFromOps after cost create failed', err);
      }
    }

    return { ...toCostRow(row), reminderSyncFailed };
  }

  async patch(tenantSlug: string, id: string, dto: PatchCostInput, actorUserId?: string) {
    if (dto.amountCents !== undefined) {
      if (!Number.isFinite(dto.amountCents) || dto.amountCents < 0) {
        throw new BadRequestException('amountCents must be a non-negative integer');
      }
    }
    if (dto.odometerKm !== undefined && dto.odometerKm !== null) {
      if (!Number.isFinite(dto.odometerKm) || dto.odometerKm < 0) {
        throw new BadRequestException('odometerKm must be a non-negative integer');
      }
    }

    const before = await this.prisma.costEntry.findFirst({
      where: { id, tenant: { slug: tenantSlug } },
      include: { vehicle: { select: { registrationNumber: true, client: { select: { code: true } } } } },
    });
    if (!before) throw new NotFoundException('Cost entry not found');

    rejectOpsEntryVehicleIdChange(dto.vehicleId, before.vehicleId);

    const nextCategory = dto.category !== undefined ? dto.category.trim() : before.category;
    let fuelLiters: number | null | undefined = undefined;
    if (dto.fuelLiters !== undefined || dto.category !== undefined) {
      if (isFuelCostCategory(nextCategory)) {
        const raw = dto.fuelLiters !== undefined ? dto.fuelLiters : before.fuelLiters;
        fuelLiters = normalizeFuelLiters(raw, nextCategory);
      } else {
        fuelLiters = null;
      }
    }

    let fuelProductType: ReturnType<typeof normalizeFuelProductType> | null | undefined = undefined;
    if (dto.fuelProductType !== undefined || dto.category !== undefined) {
      if (isFuelCostCategory(nextCategory)) {
        const raw =
          dto.fuelProductType !== undefined ? dto.fuelProductType : before.fuelProductType;
        fuelProductType = normalizeFuelProductType(raw ?? undefined, nextCategory, isFuelCostCategory);
      } else {
        fuelProductType = null;
      }
    }

    const data: Prisma.CostEntryUncheckedUpdateManyInput = {
      category: dto.category !== undefined ? dto.category.trim() : undefined,
      provider: dto.provider,
      amountCents: dto.amountCents !== undefined ? Math.round(dto.amountCents) : undefined,
      fuelLiters,
      fuelProductType,
      odometerKm: dto.odometerKm,
      invoiceNumber: dto.invoiceNumber,
      invoiceDate:
        dto.invoiceDate === undefined ? undefined : dto.invoiceDate ? new Date(dto.invoiceDate) : null,
      invoiceAttachmentUrl: dto.invoiceAttachmentUrl,
      incurredOn: dto.incurredOn !== undefined ? new Date(dto.incurredOn) : undefined,
      notes: dto.notes,
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

    const r = await this.prisma.costEntry.updateMany({
      where: { id, tenant: { slug: tenantSlug } },
      data,
    });
    if (r.count === 0) throw new NotFoundException('Cost entry not found');

    const fields = costPatchFieldKeys(
      {
        vehicleId: before.vehicleId,
        category: before.category,
        provider: before.provider,
        amountCents: before.amountCents,
        odometerKm: before.odometerKm,
        invoiceNumber: before.invoiceNumber,
        invoiceDate: before.invoiceDate,
        invoiceAttachmentUrl: before.invoiceAttachmentUrl,
        incurredOn: before.incurredOn,
        notes: before.notes,
      },
      dto,
    );

    await this.audit.log({
      tenantId: before.tenantId,
      actorUserId: actorUserId ?? undefined,
      action: 'update',
      entityType: 'cost_entry',
      entityId: id,
      meta: {
        registrationNumber: before.vehicle.registrationNumber,
        clientId: before.vehicle.client.code,
        category: before.category,
        provider: before.provider,
        fields,
        invoiceNumber: before.invoiceNumber,
      },
    });

    const updated = await this.getById(tenantSlug, id);

    let reminderSyncFailed = false;
    reminderSyncFailed = await this.applyCostReminderMenuSync(
      before.tenantId,
      {
        id: updated.id,
        vehicleId: updated.vehicleId,
        category: updated.category,
        nextDueOn: updated.nextDueOn ? new Date(updated.nextDueOn) : null,
        reminderOffsetsDays: updated.reminderOffsetsDays,
        dueOdometerKm: updated.dueOdometerKm,
        reminderOffsetsKm: updated.reminderOffsetsKm,
        reminderMenuSyncEnabled: updated.reminderMenuSyncEnabled,
      },
      `${updated.category} — ${before.vehicle.registrationNumber}`,
      dto.syncReminderAction,
    );

    if (isItpCostCategory(updated.category) && updated.nextDueOn) {
      try {
        await syncVehicleItpFromOps(
          this.prisma,
          updated.vehicleId,
          new Date(updated.nextDueOn),
          updated.provider,
        );
        await syncItpCertDocument(this.prisma, updated.vehicleId, new Date(updated.nextDueOn));
      } catch (err) {
        console.error('syncVehicleItpFromOps after cost patch failed', err);
      }
    }

    return { ...updated, reminderSyncFailed };
  }

  private async applyCostReminderMenuSync(
    tenantId: string,
    row: {
      id: string;
      vehicleId: string;
      category: string;
      nextDueOn: Date | null;
      reminderOffsetsDays: unknown;
      dueOdometerKm: number | null;
      reminderOffsetsKm: unknown;
      reminderMenuSyncEnabled: boolean;
    },
    title: string,
    syncReminderAction?: boolean,
  ): Promise<boolean> {
    if (shouldRunReminderMenuSync(row.reminderMenuSyncEnabled, syncReminderAction)) {
      try {
        await this.reminders.syncFromCost(tenantId, {
          id: row.id,
          vehicleId: row.vehicleId,
          category: row.category,
          title,
          nextDueOn: row.nextDueOn,
          reminderOffsetsDays: row.reminderOffsetsDays,
          dueOdometerKm: row.dueOdometerKm,
          reminderOffsetsKm: row.reminderOffsetsKm,
        });
        return false;
      } catch (err) {
        console.error('syncFromCost failed', err);
        return true;
      }
    }
    try {
      await this.prisma.reminderAction.deleteMany({ where: { costEntryId: row.id } });
    } catch (err) {
      console.error('delete cost reminder failed', err);
    }
    return false;
  }

  async delete(tenantSlug: string, id: string, actorUserId?: string) {
    const row = await this.prisma.costEntry.findFirst({
      where: { id, tenant: { slug: tenantSlug } },
      include: { vehicle: { select: { registrationNumber: true, client: { select: { code: true } } } } },
    });
    if (!row) throw new NotFoundException('Cost entry not found');

    await this.audit.log({
      tenantId: row.tenantId,
      actorUserId: actorUserId ?? undefined,
      action: 'delete',
      entityType: 'cost_entry',
      entityId: id,
      meta: {
        registrationNumber: row.vehicle.registrationNumber,
        clientId: row.vehicle.client.code,
        category: row.category,
        provider: row.provider,
        amountCents: row.amountCents,
        odometerKm: row.odometerKm,
        invoiceNumber: row.invoiceNumber,
      },
    });

    await this.prisma.costEntry.deleteMany({
      where: { id, tenant: { slug: tenantSlug } },
    });
  }
}
