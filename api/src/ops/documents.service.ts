import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { DOCUMENT_EXPIRING_WITHIN_DAYS, type DocumentTypeCode } from './document-types';
import {
  computeReminderSummary,
  DEFAULT_REMINDER_OFFSETS,
  normalizeReminderOffsets,
  type DocumentReminderSummary,
} from './document-reminders';
import { normalizeReminderOffsetsKm } from './reminder-status';
import { resolveOptionalClientVehicleFilter } from '../clients/client-resolve';
import type { AccessContext } from '../iam/access-context.types';
import { mergeVehicleLinkedScope } from './ops-client-scope';
import { assertDocumentOpsWrite, assertVehicleOpsWrite } from './ops-write-access';
import { assertVehicleInTenant } from './ops-scope';
import { rejectOpsEntryVehicleIdChange } from './ops-patch-guards';
import { escapeCsvCell, MAX_EXPORT_ROWS } from './ops-csv';
import { RemindersService } from './reminders.service';
import { syncItpCertDocument, syncVehicleItpFromOps } from './itp-sync';
import {
  reminderMenuSyncEnabledForCreate,
  reminderMenuSyncEnabledPatchValue,
  shouldRunReminderMenuSync,
} from './reminder-sync';

const MAX_PAGE_SIZE = 200;

export type CreateDocumentInput = {
  vehicleId: string;
  documentTypeCode: DocumentTypeCode;
  title: string;
  expiresOn?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  fileUrlVerso?: string | null;
  fileNameVerso?: string | null;
  reminderOffsetsDays?: number[] | null;
  dueOdometerKm?: number | null;
  reminderOffsetsKm?: number[] | null;
  /** Dacă true (implicit), creează/actualizează acțiune în meniul Remindere. */
  syncReminderAction?: boolean;
};

export type PatchDocumentInput = Partial<CreateDocumentInput>;

export type DocumentExpiryStatus = 'none' | 'valid' | 'expiring' | 'expired';

export type DocumentBrowseFilters = {
  registrationNumber?: string;
  clientId?: string;
  documentTypeCode?: string;
  expiryStatus?: DocumentExpiryStatus;
  q?: string;
  expiresFrom?: string;
  expiresTo?: string;
};

export type DocumentListParams = DocumentBrowseFilters & {
  page: number;
  pageSize: number;
};

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

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

async function documentWhere(
  prisma: PrismaService,
  tenantId: string,
  f: DocumentBrowseFilters,
  access?: AccessContext,
): Promise<Prisma.VehicleDocumentWhereInput> {
  const parts: Prisma.VehicleDocumentWhereInput[] = [{ vehicle: { tenantId } }];
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
  if (f.documentTypeCode?.trim()) {
    const code = f.documentTypeCode.trim();
    if (code === 'civ') {
      parts.push({ documentTypeCode: { in: ['civ', 'civ_fata', 'civ_verso'] } });
    } else {
      parts.push({ documentTypeCode: code });
    }
  }
  if (f.q?.trim()) {
    const q = f.q.trim();
    parts.push({
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { documentTypeCode: { contains: q, mode: 'insensitive' } },
      ],
    });
  }
  if (f.expiresFrom?.trim()) {
    parts.push({ expiresOn: { gte: parseDayStart(f.expiresFrom) } });
  }
  if (f.expiresTo?.trim()) {
    parts.push({ expiresOn: { lte: parseDayEnd(f.expiresTo) } });
  }

  if (f.expiryStatus) {
    const today = startOfUtcDay(new Date());
    const expiringUntil = new Date(today);
    expiringUntil.setUTCDate(expiringUntil.getUTCDate() + DOCUMENT_EXPIRING_WITHIN_DAYS);

    switch (f.expiryStatus) {
      case 'none':
        parts.push({ expiresOn: null });
        break;
      case 'expired':
        parts.push({ expiresOn: { lt: today } });
        break;
      case 'expiring':
        parts.push({ expiresOn: { gte: today, lte: expiringUntil } });
        break;
      case 'valid':
        parts.push({ expiresOn: { gt: expiringUntil } });
        break;
    }
  }

  return { AND: parts };
}

function reminderOffsetsForDb(
  value: number[] | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  return value;
}

function toDocRow(row: {
  id: string;
  vehicleId: string;
  documentTypeCode: string;
  title: string;
  expiresOn: Date | null;
  fileUrl: string | null;
  fileName: string | null;
  fileUrlVerso?: string | null;
  fileNameVerso?: string | null;
  reminderOffsetsDays: unknown;
  dueOdometerKm: number | null;
  reminderOffsetsKm: unknown;
  reminderMenuSyncEnabled: boolean;
  createdAt: Date;
  vehicle: { registrationNumber: string; client: { code: string }; tenant: { slug: string } };
}) {
  const reminderOffsetsDays = normalizeReminderOffsets(row.reminderOffsetsDays);
  const reminder = computeReminderSummary(row.expiresOn, reminderOffsetsDays);
  return {
    id: row.id,
    tenantSlug: row.vehicle.tenant.slug,
    vehicleId: row.vehicleId,
    registrationNumber: row.vehicle.registrationNumber,
    clientId: row.vehicle.client.code,
    documentTypeCode: row.documentTypeCode,
    title: row.title,
    expiresOn: row.expiresOn ? row.expiresOn.toISOString() : null,
    fileUrl: row.fileUrl,
    fileName: row.fileName,
    fileUrlVerso: row.fileUrlVerso ?? null,
    fileNameVerso: row.fileNameVerso ?? null,
    reminderOffsetsDays,
    dueOdometerKm: row.dueOdometerKm,
    reminderOffsetsKm: normalizeReminderOffsetsKm(row.reminderOffsetsKm),
    reminderMenuSyncEnabled: row.reminderMenuSyncEnabled,
    reminder,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly reminders: RemindersService,
  ) {}

  async list(tenantSlug: string, params: DocumentListParams, access?: AccessContext) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return { items: [], total: 0, page: params.page, pageSize: params.pageSize };
    }
    const pageSize = Math.min(Math.max(1, params.pageSize), MAX_PAGE_SIZE);
    const page = Math.max(1, params.page);
    const skip = (page - 1) * pageSize;

    const where = await documentWhere(this.prisma, tenant.id, {
      registrationNumber: params.registrationNumber,
      clientId: params.clientId,
      documentTypeCode: params.documentTypeCode,
      expiryStatus: params.expiryStatus,
      q: params.q,
      expiresFrom: params.expiresFrom,
      expiresTo: params.expiresTo,
    }, access);

    const [total, rows] = await Promise.all([
      this.prisma.vehicleDocument.count({ where }),
      this.prisma.vehicleDocument.findMany({
        where,
        include: {
          vehicle: {
            select: {
              registrationNumber: true,
              client: { select: { code: true } },
              tenant: { select: { slug: true } },
            },
          },
        },
        orderBy: [{ expiresOn: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map(toDocRow),
      total,
      page,
      pageSize,
    };
  }

  async exportCsv(tenantSlug: string, filters: DocumentBrowseFilters, access?: AccessContext): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return '\uFEFFid,vehicleId,registrationNumber,clientId,documentTypeCode,title,expiresOn,fileUrl,fileName,reminderOffsetsDays,createdAt\n';
    }
    const where = await documentWhere(this.prisma, tenant.id, filters, access);
    const rows = await this.prisma.vehicleDocument.findMany({
      where,
      orderBy: [{ expiresOn: 'asc' }, { createdAt: 'desc' }],
      take: MAX_EXPORT_ROWS,
      include: {
        vehicle: { select: { registrationNumber: true, client: { select: { code: true } } } },
      },
    });
    const header =
      'id,vehicleId,registrationNumber,clientId,documentTypeCode,title,expiresOn,fileUrl,fileName,reminderOffsetsDays,createdAt';
    const lines = rows.map((r) =>
      [
        r.id,
        r.vehicleId,
        r.vehicle.registrationNumber,
        r.vehicle.client.code,
        r.documentTypeCode,
        r.title,
        r.expiresOn ? r.expiresOn.toISOString() : '',
        r.fileUrl ?? '',
        r.fileName ?? '',
        r.reminderOffsetsDays ? JSON.stringify(r.reminderOffsetsDays) : '',
        r.createdAt.toISOString(),
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
    const row = await this.prisma.vehicleDocument.findFirst({
      where: { id, vehicle: { tenant: { slug: tenantSlug } }, ...clientFilter },
      include: {
        vehicle: {
          select: {
            registrationNumber: true,
            client: { select: { code: true } },
            tenant: { select: { slug: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Document not found');
    return toDocRow(row);
  }

  async create(tenantSlug: string, dto: CreateDocumentInput, actorUserId?: string, access?: AccessContext) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    await assertVehicleOpsWrite(this.prisma, tenantSlug, dto.vehicleId, access);
    const vehicle = await assertVehicleInTenant(this.prisma, tenantSlug, dto.vehicleId);

    const reminderOffsets =
      dto.reminderOffsetsDays === undefined
        ? dto.expiresOn
          ? DEFAULT_REMINDER_OFFSETS
          : null
        : dto.reminderOffsetsDays;

    const row = await this.prisma.vehicleDocument.create({
      data: {
        vehicleId: dto.vehicleId,
        documentTypeCode: dto.documentTypeCode,
        title: dto.title,
        expiresOn:
          dto.expiresOn === undefined ? null : dto.expiresOn ? new Date(dto.expiresOn) : null,
        fileUrl: dto.fileUrl ?? null,
        fileName: dto.fileName ?? null,
        fileUrlVerso: dto.fileUrlVerso ?? null,
        fileNameVerso: dto.fileNameVerso ?? null,
        reminderOffsetsDays: reminderOffsetsForDb(reminderOffsets),
        dueOdometerKm: dto.dueOdometerKm ?? null,
        reminderOffsetsKm: reminderOffsetsForDb(dto.reminderOffsetsKm),
        reminderMenuSyncEnabled: reminderMenuSyncEnabledForCreate(dto.syncReminderAction),
      },
      include: {
        vehicle: {
          select: {
            registrationNumber: true,
            client: { select: { code: true } },
            tenant: { select: { slug: true } },
          },
        },
      },
    });

    await this.audit.logVehicle({
      tenantUuid: tenant.id,
      actorUserId: actorUserId ?? undefined,
      action: 'document_add',
      vehicleId: dto.vehicleId,
      meta: {
        documentId: row.id,
        documentTypeCode: dto.documentTypeCode,
        title: dto.title,
        registrationNumber: vehicle.registrationNumber,
      },
    });

    let reminderSyncFailed = false;
    reminderSyncFailed = await this.applyDocumentReminderMenuSync(tenant.id, row, dto.syncReminderAction);

    if (row.documentTypeCode === 'itp_cert' && row.expiresOn) {
      try {
        await syncVehicleItpFromOps(this.prisma, row.vehicleId, row.expiresOn);
      } catch (err) {
        console.error('syncVehicleItpFromOps after document create failed', err);
      }
    }

    return { ...toDocRow(row), reminderSyncFailed };
  }

  async patch(tenantSlug: string, id: string, dto: PatchDocumentInput, actorUserId?: string, access?: AccessContext) {
    await assertDocumentOpsWrite(this.prisma, tenantSlug, id, access);
    if (dto.vehicleId) {
      await assertVehicleOpsWrite(this.prisma, tenantSlug, dto.vehicleId, access);
    }
    const before = await this.prisma.vehicleDocument.findFirst({
      where: { id, vehicle: { tenant: { slug: tenantSlug } } },
      include: { vehicle: { select: { registrationNumber: true, tenantId: true } } },
    });
    if (!before) throw new NotFoundException('Document not found');

    rejectOpsEntryVehicleIdChange(dto.vehicleId, before.vehicleId);

    const row = await this.prisma.vehicleDocument.update({
      where: { id },
      data: {
        documentTypeCode: dto.documentTypeCode,
        title: dto.title,
        expiresOn:
          dto.expiresOn === undefined
            ? undefined
            : dto.expiresOn
              ? new Date(dto.expiresOn)
              : null,
        fileUrl: dto.fileUrl === undefined ? undefined : dto.fileUrl,
        fileName: dto.fileName === undefined ? undefined : dto.fileName,
        fileUrlVerso: dto.fileUrlVerso === undefined ? undefined : dto.fileUrlVerso,
        fileNameVerso: dto.fileNameVerso === undefined ? undefined : dto.fileNameVerso,
        reminderOffsetsDays: reminderOffsetsForDb(dto.reminderOffsetsDays),
        dueOdometerKm: dto.dueOdometerKm,
        reminderOffsetsKm: reminderOffsetsForDb(dto.reminderOffsetsKm),
        reminderMenuSyncEnabled: reminderMenuSyncEnabledPatchValue(dto.syncReminderAction),
      },
      include: {
        vehicle: {
          select: {
            registrationNumber: true,
            client: { select: { code: true } },
            tenant: { select: { slug: true } },
          },
        },
      },
    });

    await this.audit.logVehicle({
      tenantUuid: before.vehicle.tenantId,
      actorUserId: actorUserId ?? undefined,
      action: 'document_update',
      vehicleId: row.vehicleId,
      meta: {
        documentId: row.id,
        documentTypeCode: row.documentTypeCode,
        title: row.title,
        registrationNumber: before.vehicle.registrationNumber,
      },
    });

    let reminderSyncFailed = false;
    reminderSyncFailed = await this.applyDocumentReminderMenuSync(
      before.vehicle.tenantId,
      row,
      dto.syncReminderAction,
    );

    if (row.documentTypeCode === 'itp_cert' && row.expiresOn) {
      try {
        await syncVehicleItpFromOps(this.prisma, row.vehicleId, row.expiresOn);
      } catch (err) {
        console.error('syncVehicleItpFromOps after document patch failed', err);
      }
    }

    return { ...toDocRow(row), reminderSyncFailed };
  }

  private async applyDocumentReminderMenuSync(
    tenantId: string,
    row: {
      id: string;
      vehicleId: string;
      title: string;
      expiresOn: Date | null;
      reminderOffsetsDays: unknown;
      dueOdometerKm: number | null;
      reminderOffsetsKm: unknown;
      reminderMenuSyncEnabled: boolean;
    },
    syncReminderAction?: boolean,
  ): Promise<boolean> {
    if (shouldRunReminderMenuSync(row.reminderMenuSyncEnabled, syncReminderAction)) {
      try {
        await this.reminders.syncFromDocument(tenantId, {
          id: row.id,
          vehicleId: row.vehicleId,
          title: row.title,
          expiresOn: row.expiresOn,
          reminderOffsetsDays: row.reminderOffsetsDays,
          dueOdometerKm: row.dueOdometerKm,
          reminderOffsetsKm: row.reminderOffsetsKm,
        });
        return false;
      } catch (err) {
        console.error('syncFromDocument failed', err);
        return true;
      }
    }
    try {
      await this.prisma.reminderAction.deleteMany({ where: { vehicleDocumentId: row.id } });
    } catch (err) {
      console.error('delete document reminder failed', err);
    }
    return false;
  }

  async delete(tenantSlug: string, id: string, actorUserId?: string, access?: AccessContext) {
    await assertDocumentOpsWrite(this.prisma, tenantSlug, id, access);
    const row = await this.prisma.vehicleDocument.findFirst({
      where: { id, vehicle: { tenant: { slug: tenantSlug } } },
      include: { vehicle: { select: { registrationNumber: true, tenantId: true } } },
    });
    if (!row) throw new NotFoundException('Document not found');

    await this.prisma.vehicleDocument.delete({ where: { id } });

    await this.audit.logVehicle({
      tenantUuid: row.vehicle.tenantId,
      actorUserId: actorUserId ?? undefined,
      action: 'document_delete',
      vehicleId: row.vehicleId,
      meta: {
        documentId: row.id,
        documentTypeCode: row.documentTypeCode,
        title: row.title,
        registrationNumber: row.vehicle.registrationNumber,
      },
    });
  }
}
