import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReminderSourceType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_REMINDER_OFFSETS, normalizeReminderOffsets } from './document-reminders';
import { assertVehicleInTenant } from './ops-scope';
import { escapeCsvCell, MAX_EXPORT_ROWS } from './ops-csv';
import {
  computeReminderActionSummary,
  matchesActionReminderFilter,
  normalizeReminderOffsetsKm,
  type ReminderActionSummary,
} from './reminder-status';
import type { ReminderListFilterStatus } from './document-reminders';

const MAX_PAGE_SIZE = 200;

export type CreateReminderInput = {
  vehicleId: string;
  sourceType: ReminderSourceType;
  title: string;
  notes?: string | null;
  vehicleDocumentId?: string | null;
  maintenanceEntryId?: string | null;
  dueOn?: string | null;
  reminderOffsetsDays?: number[] | null;
  dueOdometerKm?: number | null;
  reminderOffsetsKm?: number[] | null;
  intervalDays?: number | null;
  intervalKm?: number | null;
  lastPerformedOn?: string | null;
  lastPerformedOdometerKm?: number | null;
  isActive?: boolean;
};

export type PatchReminderInput = Partial<CreateReminderInput>;

export type ReminderBrowseFilters = {
  registrationNumber?: string;
  clientId?: string;
  vehicleId?: string;
  sourceType?: ReminderSourceType;
  q?: string;
  dueFrom?: string;
  dueTo?: string;
  status?: ReminderListFilterStatus;
};

export type ReminderListParams = ReminderBrowseFilters & {
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

function reminderOffsetsForDb(
  value: number[] | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  return value;
}

function reminderWhere(tenantId: string, f: ReminderBrowseFilters): Prisma.ReminderActionWhereInput {
  const parts: Prisma.ReminderActionWhereInput[] = [{ tenantId, isActive: true }];
  if (f.vehicleId?.trim()) parts.push({ vehicleId: f.vehicleId.trim() });
  if (f.registrationNumber?.trim()) {
    parts.push({
      vehicle: {
        tenantId,
        registrationNumber: { equals: f.registrationNumber.trim(), mode: 'insensitive' },
      },
    });
  }
  if (f.clientId?.trim()) {
    parts.push({
      vehicle: { tenantId, clientId: { equals: f.clientId.trim(), mode: 'insensitive' } },
    });
  }
  if (f.sourceType) parts.push({ sourceType: f.sourceType });
  if (f.q?.trim()) {
    const q = f.q.trim();
    parts.push({
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
      ],
    });
  }
  if (f.dueFrom?.trim()) parts.push({ dueOn: { gte: parseDayStart(f.dueFrom) } });
  if (f.dueTo?.trim()) parts.push({ dueOn: { lte: parseDayEnd(f.dueTo) } });
  return { AND: parts };
}

function toRow(row: {
  id: string;
  tenantId: string;
  vehicleId: string;
  sourceType: ReminderSourceType;
  title: string;
  notes: string | null;
  vehicleDocumentId: string | null;
  maintenanceEntryId: string | null;
  costEntryId: string | null;
  dueOn: Date | null;
  reminderOffsetsDays: unknown;
  dueOdometerKm: number | null;
  reminderOffsetsKm: unknown;
  intervalDays: number | null;
  intervalKm: number | null;
  lastPerformedOn: Date | null;
  lastPerformedOdometerKm: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  vehicle: {
    registrationNumber: string;
    clientId: string;
    odometerKm: number;
    tenant: { slug: string };
  };
  document?: { documentTypeCode: string } | null;
  maintenance?: { title: string } | null;
  cost?: { category: string } | null;
}) {
  const reminderOffsetsDays = normalizeReminderOffsets(row.reminderOffsetsDays);
  const reminderOffsetsKm = normalizeReminderOffsetsKm(row.reminderOffsetsKm);
  const summary = computeReminderActionSummary(
    {
      isActive: row.isActive,
      dueOn: row.dueOn,
      reminderOffsetsDays,
      dueOdometerKm: row.dueOdometerKm,
      reminderOffsetsKm,
    },
    row.vehicle.odometerKm,
  );

  return {
    id: row.id,
    tenantSlug: row.vehicle.tenant.slug,
    vehicleId: row.vehicleId,
    registrationNumber: row.vehicle.registrationNumber,
    clientId: row.vehicle.clientId,
    vehicleOdometerKm: row.vehicle.odometerKm,
    sourceType: row.sourceType,
    title: row.title,
    notes: row.notes,
    vehicleDocumentId: row.vehicleDocumentId,
    maintenanceEntryId: row.maintenanceEntryId,
    costEntryId: row.costEntryId,
    documentTypeCode: row.document?.documentTypeCode ?? null,
    linkedMaintenanceTitle: row.maintenance?.title ?? null,
    linkedCostCategory: row.cost?.category ?? null,
    dueOn: row.dueOn ? row.dueOn.toISOString() : null,
    reminderOffsetsDays,
    dueOdometerKm: row.dueOdometerKm,
    reminderOffsetsKm,
    intervalDays: row.intervalDays,
    intervalKm: row.intervalKm,
    lastPerformedOn: row.lastPerformedOn ? row.lastPerformedOn.toISOString() : null,
    lastPerformedOdometerKm: row.lastPerformedOdometerKm,
    isActive: row.isActive,
    summary,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const includeRow = {
  vehicle: {
    select: {
      registrationNumber: true,
      clientId: true,
      odometerKm: true,
      tenant: { select: { slug: true } },
    },
  },
  document: { select: { documentTypeCode: true } },
  maintenance: { select: { title: true } },
  cost: { select: { category: true } },
} as const;

@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantSlug: string, params: ReminderListParams) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return { items: [], total: 0, page: params.page, pageSize: params.pageSize };
    }

    const where = reminderWhere(tenant.id, params);
    const rows = await this.prisma.reminderAction.findMany({
      where,
      include: includeRow,
      orderBy: [{ dueOn: 'asc' }, { createdAt: 'desc' }],
    });

    let mapped = rows.map(toRow);
    if (params.status && params.status !== 'all') {
      mapped = mapped.filter((r) => matchesActionReminderFilter(r.summary, params.status!));
    }

    const total = mapped.length;
    const pageSize = Math.min(Math.max(1, params.pageSize), MAX_PAGE_SIZE);
    const page = Math.max(1, params.page);
    const skip = (page - 1) * pageSize;
    const items = mapped.slice(skip, skip + pageSize);

    return { items, total, page, pageSize };
  }

  async exportCsv(tenantSlug: string, filters: ReminderBrowseFilters): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return '\uFEFFid,vehicleId,registrationNumber,sourceType,title,dueOn,dueOdometerKm,isActive,createdAt\n';
    }

    const where = reminderWhere(tenant.id, filters);
    const rows = await this.prisma.reminderAction.findMany({
      where,
      include: includeRow,
      orderBy: [{ dueOn: 'asc' }, { createdAt: 'desc' }],
      take: MAX_EXPORT_ROWS,
    });

    let mapped = rows.map(toRow);
    if (filters.status && filters.status !== 'all') {
      mapped = mapped.filter((r) => matchesActionReminderFilter(r.summary, filters.status!));
    }

    const header =
      'id,vehicleId,registrationNumber,clientId,sourceType,title,dueOn,reminderOffsetsDays,dueOdometerKm,reminderOffsetsKm,intervalDays,intervalKm,isActive,status,createdAt';
    const lines = mapped.map((r) =>
      [
        r.id,
        r.vehicleId,
        r.registrationNumber,
        r.clientId,
        r.sourceType,
        r.title,
        r.dueOn ?? '',
        r.reminderOffsetsDays ? JSON.stringify(r.reminderOffsetsDays) : '',
        r.dueOdometerKm ?? '',
        r.reminderOffsetsKm ? JSON.stringify(r.reminderOffsetsKm) : '',
        r.intervalDays ?? '',
        r.intervalKm ?? '',
        r.isActive ? 'true' : 'false',
        r.summary.status,
        r.createdAt,
      ]
        .map((c) => escapeCsvCell(String(c)))
        .join(','),
    );
    return `\uFEFF${header}\n${lines.join('\n')}\n`;
  }

  async getById(tenantSlug: string, id: string) {
    const row = await this.prisma.reminderAction.findFirst({
      where: { id, tenant: { slug: tenantSlug } },
      include: includeRow,
    });
    if (!row) throw new NotFoundException('Reminder not found');
    return toRow(row);
  }

  async vehicleContext(tenantSlug: string, vehicleId: string) {
    await assertVehicleInTenant(this.prisma, tenantSlug, vehicleId);
    const [documents, maintenance, vehicle] = await Promise.all([
      this.prisma.vehicleDocument.findMany({
        where: { vehicleId },
        orderBy: [{ expiresOn: 'asc' }, { title: 'asc' }],
        select: { id: true, title: true, documentTypeCode: true, expiresOn: true },
      }),
      this.prisma.maintenanceEntry.findMany({
        where: { vehicleId },
        orderBy: [{ performedAt: 'desc' }, { title: 'asc' }],
        select: { id: true, title: true, performedAt: true, odometerKm: true },
      }),
      this.prisma.vehicle.findUnique({
        where: { id: vehicleId },
        select: { odometerKm: true, registrationNumber: true },
      }),
    ]);
    return {
      vehicleOdometerKm: vehicle?.odometerKm ?? 0,
      registrationNumber: vehicle?.registrationNumber ?? '',
      documents: documents.map((d) => ({
        id: d.id,
        title: d.title,
        documentTypeCode: d.documentTypeCode,
        expiresOn: d.expiresOn ? d.expiresOn.toISOString() : null,
      })),
      maintenance: maintenance.map((m) => ({
        id: m.id,
        title: m.title,
        performedAt: m.performedAt ? m.performedAt.toISOString() : null,
        odometerKm: m.odometerKm,
      })),
    };
  }

  async create(tenantSlug: string, dto: CreateReminderInput, actorUserId?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const vehicle = await assertVehicleInTenant(this.prisma, tenantSlug, dto.vehicleId);

    const enriched = await this.enrichDtoFromLinks(tenant.id, dto);
    await this.validateLinks(tenant.id, enriched);

    const row = await this.prisma.reminderAction.create({
      data: this.buildCreateData(tenant.id, enriched),
      include: includeRow,
    });

    await this.audit.logVehicle({
      tenantUuid: tenant.id,
      actorUserId: actorUserId ?? undefined,
      action: 'reminder_add',
      vehicleId: dto.vehicleId,
      meta: { reminderId: row.id, title: row.title, registrationNumber: vehicle.registrationNumber },
    });

    return toRow(row);
  }

  async patch(tenantSlug: string, id: string, dto: PatchReminderInput, actorUserId?: string) {
    const before = await this.prisma.reminderAction.findFirst({
      where: { id, tenant: { slug: tenantSlug } },
      include: { vehicle: { select: { registrationNumber: true, tenantId: true } } },
    });
    if (!before) throw new NotFoundException('Reminder not found');

    const vehicleId = dto.vehicleId ?? before.vehicleId;
    if (dto.vehicleId) await assertVehicleInTenant(this.prisma, tenantSlug, dto.vehicleId);
    await this.validateLinks(before.tenantId, { ...dto, vehicleId, sourceType: dto.sourceType ?? before.sourceType });

    const row = await this.prisma.reminderAction.update({
      where: { id },
      data: this.buildPatchData(dto),
      include: includeRow,
    });

    await this.audit.logVehicle({
      tenantUuid: before.vehicle.tenantId,
      actorUserId: actorUserId ?? undefined,
      action: 'reminder_update',
      vehicleId: row.vehicleId,
      meta: {
        reminderId: row.id,
        title: row.title,
        registrationNumber: before.vehicle.registrationNumber,
      },
    });

    return toRow(row);
  }

  async delete(tenantSlug: string, id: string, actorUserId?: string) {
    const row = await this.prisma.reminderAction.findFirst({
      where: { id, tenant: { slug: tenantSlug } },
      include: { vehicle: { select: { registrationNumber: true, tenantId: true } } },
    });
    if (!row) throw new NotFoundException('Reminder not found');
    if (row.sourceType === 'document' && row.vehicleDocumentId) {
      throw new BadRequestException(
        'Reminderul legat de document se gestionează din Documente. Editează documentul sau dezactivează reminderele acolo.',
      );
    }
    if (row.sourceType === 'maintenance' && row.maintenanceEntryId) {
      throw new BadRequestException(
        'Reminderul legat de mentenanță se gestionează din Mentenanță. Editează intervenția sau dezactivează reminderele acolo.',
      );
    }
    if (row.sourceType === 'cost' && row.costEntryId) {
      throw new BadRequestException(
        'Reminderul legat de cost se gestionează din Costuri. Editează înregistrarea sau dezactivează reminderele acolo.',
      );
    }

    await this.audit.logVehicle({
      tenantUuid: row.vehicle.tenantId,
      actorUserId: actorUserId ?? undefined,
      action: 'reminder_delete',
      vehicleId: row.vehicleId,
      meta: {
        reminderId: row.id,
        title: row.title,
        registrationNumber: row.vehicle.registrationNumber,
      },
    });

    await this.prisma.reminderAction.delete({ where: { id } });
  }

  /** Sincronizează acțiunea de reminder din setările documentului. */
  async syncFromDocument(
    tenantId: string,
    doc: {
      id: string;
      vehicleId: string;
      title: string;
      expiresOn: Date | null;
      reminderOffsetsDays: unknown;
    },
  ) {
    const offsets = normalizeReminderOffsets(doc.reminderOffsetsDays);
    if (!doc.expiresOn || !offsets?.length) {
      await this.prisma.reminderAction.deleteMany({ where: { vehicleDocumentId: doc.id } });
      return null;
    }

    return this.prisma.reminderAction.upsert({
      where: { vehicleDocumentId: doc.id },
      create: {
        tenantId,
        vehicleId: doc.vehicleId,
        sourceType: ReminderSourceType.document,
        title: doc.title,
        vehicleDocumentId: doc.id,
        dueOn: doc.expiresOn,
        reminderOffsetsDays: offsets,
        isActive: true,
      },
      update: {
        vehicleId: doc.vehicleId,
        title: doc.title,
        dueOn: doc.expiresOn,
        reminderOffsetsDays: offsets,
        isActive: true,
      },
      include: includeRow,
    });
  }

  /** Sincronizează acțiunea de reminder din setările unei intervenții de mentenanță. */
  async syncFromMaintenance(
    tenantId: string,
    entry: {
      id: string;
      vehicleId: string;
      title: string;
      nextDueOn: Date | null;
      reminderOffsetsDays: unknown;
    },
  ) {
    const offsets = normalizeReminderOffsets(entry.reminderOffsetsDays);
    if (!entry.nextDueOn || !offsets?.length) {
      await this.prisma.reminderAction.deleteMany({ where: { maintenanceEntryId: entry.id } });
      return null;
    }

    return this.prisma.reminderAction.upsert({
      where: { maintenanceEntryId: entry.id },
      create: {
        tenantId,
        vehicleId: entry.vehicleId,
        sourceType: ReminderSourceType.maintenance,
        title: entry.title,
        maintenanceEntryId: entry.id,
        dueOn: entry.nextDueOn,
        reminderOffsetsDays: offsets,
        isActive: true,
      },
      update: {
        vehicleId: entry.vehicleId,
        title: entry.title,
        dueOn: entry.nextDueOn,
        reminderOffsetsDays: offsets,
        isActive: true,
      },
      include: includeRow,
    });
  }

  /** Sincronizează acțiunea de reminder din setările unui cost. */
  async syncFromCost(
    tenantId: string,
    cost: {
      id: string;
      vehicleId: string;
      category: string;
      title: string;
      nextDueOn: Date | null;
      reminderOffsetsDays: unknown;
    },
  ) {
    const offsets = normalizeReminderOffsets(cost.reminderOffsetsDays);
    if (!cost.nextDueOn || !offsets?.length) {
      await this.prisma.reminderAction.deleteMany({ where: { costEntryId: cost.id } });
      return null;
    }

    return this.prisma.reminderAction.upsert({
      where: { costEntryId: cost.id },
      create: {
        tenantId,
        vehicleId: cost.vehicleId,
        sourceType: ReminderSourceType.cost,
        title: cost.title,
        costEntryId: cost.id,
        dueOn: cost.nextDueOn,
        reminderOffsetsDays: offsets,
        isActive: true,
      },
      update: {
        vehicleId: cost.vehicleId,
        title: cost.title,
        dueOn: cost.nextDueOn,
        reminderOffsetsDays: offsets,
        isActive: true,
      },
      include: includeRow,
    });
  }

  private buildCreateData(tenantId: string, dto: CreateReminderInput): Prisma.ReminderActionCreateInput {
    return {
      tenant: { connect: { id: tenantId } },
      vehicle: { connect: { id: dto.vehicleId } },
      sourceType: dto.sourceType,
      title: dto.title.trim(),
      notes: dto.notes ?? null,
      document: dto.vehicleDocumentId ? { connect: { id: dto.vehicleDocumentId } } : undefined,
      maintenance: dto.maintenanceEntryId ? { connect: { id: dto.maintenanceEntryId } } : undefined,
      dueOn: dto.dueOn ? new Date(dto.dueOn) : null,
      reminderOffsetsDays: reminderOffsetsForDb(dto.reminderOffsetsDays),
      dueOdometerKm: dto.dueOdometerKm ?? null,
      reminderOffsetsKm: reminderOffsetsForDb(dto.reminderOffsetsKm),
      intervalDays: dto.intervalDays ?? null,
      intervalKm: dto.intervalKm ?? null,
      lastPerformedOn: dto.lastPerformedOn ? new Date(dto.lastPerformedOn) : null,
      lastPerformedOdometerKm: dto.lastPerformedOdometerKm ?? null,
      isActive: dto.isActive ?? true,
    };
  }

  private buildPatchData(dto: PatchReminderInput): Prisma.ReminderActionUpdateInput {
    const data: Prisma.ReminderActionUpdateInput = {};
    if (dto.vehicleId !== undefined) data.vehicle = { connect: { id: dto.vehicleId } };
    if (dto.sourceType !== undefined) data.sourceType = dto.sourceType;
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.vehicleDocumentId !== undefined) {
      data.document =
        dto.vehicleDocumentId === null
          ? { disconnect: true }
          : { connect: { id: dto.vehicleDocumentId } };
    }
    if (dto.maintenanceEntryId !== undefined) {
      data.maintenance =
        dto.maintenanceEntryId === null
          ? { disconnect: true }
          : { connect: { id: dto.maintenanceEntryId } };
    }
    if (dto.dueOn !== undefined) data.dueOn = dto.dueOn ? new Date(dto.dueOn) : null;
    if (dto.reminderOffsetsDays !== undefined) {
      data.reminderOffsetsDays = reminderOffsetsForDb(dto.reminderOffsetsDays);
    }
    if (dto.dueOdometerKm !== undefined) data.dueOdometerKm = dto.dueOdometerKm;
    if (dto.reminderOffsetsKm !== undefined) {
      data.reminderOffsetsKm = reminderOffsetsForDb(dto.reminderOffsetsKm);
    }
    if (dto.intervalDays !== undefined) data.intervalDays = dto.intervalDays;
    if (dto.intervalKm !== undefined) data.intervalKm = dto.intervalKm;
    if (dto.lastPerformedOn !== undefined) {
      data.lastPerformedOn = dto.lastPerformedOn ? new Date(dto.lastPerformedOn) : null;
    }
    if (dto.lastPerformedOdometerKm !== undefined) {
      data.lastPerformedOdometerKm = dto.lastPerformedOdometerKm;
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    return data;
  }

  private async enrichDtoFromLinks(
    tenantId: string,
    dto: CreateReminderInput,
  ): Promise<CreateReminderInput> {
    const out = { ...dto };
    if (dto.sourceType === 'document' && dto.vehicleDocumentId) {
      const doc = await this.prisma.vehicleDocument.findFirst({
        where: { id: dto.vehicleDocumentId, vehicleId: dto.vehicleId, vehicle: { tenantId } },
      });
      if (doc) {
        if (!out.title?.trim()) out.title = doc.title;
        if (!out.dueOn && doc.expiresOn) out.dueOn = doc.expiresOn.toISOString();
        if (!out.reminderOffsetsDays && doc.reminderOffsetsDays) {
          out.reminderOffsetsDays = normalizeReminderOffsets(doc.reminderOffsetsDays);
        }
      }
    }
    if (dto.sourceType === 'maintenance' && dto.maintenanceEntryId) {
      const m = await this.prisma.maintenanceEntry.findFirst({
        where: { id: dto.maintenanceEntryId, vehicleId: dto.vehicleId, tenantId },
      });
      if (m && !out.title?.trim()) out.title = m.title;
    }
    return out;
  }

  private async validateLinks(
    tenantId: string,
    dto: Partial<CreateReminderInput> & { vehicleId: string; sourceType: ReminderSourceType },
  ) {
    if (dto.sourceType === 'document') {
      if (!dto.vehicleDocumentId) {
        throw new BadRequestException('vehicleDocumentId is required for document reminders');
      }
      const doc = await this.prisma.vehicleDocument.findFirst({
        where: { id: dto.vehicleDocumentId, vehicleId: dto.vehicleId, vehicle: { tenantId } },
      });
      if (!doc) throw new BadRequestException('Document not found for this vehicle');
    } else if (dto.sourceType === 'maintenance') {
      if (!dto.maintenanceEntryId) {
        throw new BadRequestException('maintenanceEntryId is required for maintenance reminders');
      }
      const m = await this.prisma.maintenanceEntry.findFirst({
        where: { id: dto.maintenanceEntryId, vehicleId: dto.vehicleId, tenantId },
      });
      if (!m) throw new BadRequestException('Maintenance entry not found for this vehicle');
    } else if (dto.sourceType === 'custom') {
      if (dto.vehicleDocumentId || dto.maintenanceEntryId) {
        throw new BadRequestException('Custom reminders cannot link to document or maintenance');
      }
      if (!dto.title?.trim()) throw new BadRequestException('title is required');
    }

    const hasTime = Boolean(dto.dueOn);
    const hasKm = dto.dueOdometerKm != null && dto.dueOdometerKm > 0;
    const hasInterval = (dto.intervalDays ?? 0) > 0 || (dto.intervalKm ?? 0) > 0;
    if (!hasTime && !hasKm && !hasInterval) {
      if (dto.sourceType === 'custom') {
        throw new BadRequestException(
          'Setează data scadență, km țintă sau interval (zile/km) pentru acțiunea personalizată.',
        );
      }
      if (dto.sourceType === 'document' && dto.vehicleDocumentId) {
        throw new BadRequestException(
          'Documentul legat trebuie să aibă dată de expirare sau completează manual scadența.',
        );
      }
    }
  }
}

export type ReminderActionRow = ReturnType<typeof toRow> & { summary: ReminderActionSummary };

export { DEFAULT_REMINDER_OFFSETS };
