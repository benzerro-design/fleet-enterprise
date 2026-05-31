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
import { assertVehicleInTenant } from './ops-scope';
import { escapeCsvCell, MAX_EXPORT_ROWS } from './ops-csv';
import { RemindersService } from './reminders.service';

const MAX_PAGE_SIZE = 200;

export type CreateDocumentInput = {
  vehicleId: string;
  documentTypeCode: DocumentTypeCode;
  title: string;
  expiresOn?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  reminderOffsetsDays?: number[] | null;
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

function documentWhere(tenantId: string, f: DocumentBrowseFilters): Prisma.VehicleDocumentWhereInput {
  const parts: Prisma.VehicleDocumentWhereInput[] = [{ vehicle: { tenantId } }];

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
  if (f.documentTypeCode?.trim()) {
    parts.push({ documentTypeCode: f.documentTypeCode.trim() });
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
  reminderOffsetsDays: unknown;
  createdAt: Date;
  vehicle: { registrationNumber: string; clientId: string; tenant: { slug: string } };
}) {
  const reminderOffsetsDays = normalizeReminderOffsets(row.reminderOffsetsDays);
  const reminder = computeReminderSummary(row.expiresOn, reminderOffsetsDays);
  return {
    id: row.id,
    tenantSlug: row.vehicle.tenant.slug,
    vehicleId: row.vehicleId,
    registrationNumber: row.vehicle.registrationNumber,
    clientId: row.vehicle.clientId,
    documentTypeCode: row.documentTypeCode,
    title: row.title,
    expiresOn: row.expiresOn ? row.expiresOn.toISOString() : null,
    fileUrl: row.fileUrl,
    fileName: row.fileName,
    reminderOffsetsDays,
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

  async list(tenantSlug: string, params: DocumentListParams) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return { items: [], total: 0, page: params.page, pageSize: params.pageSize };
    }
    const pageSize = Math.min(Math.max(1, params.pageSize), MAX_PAGE_SIZE);
    const page = Math.max(1, params.page);
    const skip = (page - 1) * pageSize;

    const where = documentWhere(tenant.id, {
      registrationNumber: params.registrationNumber,
      clientId: params.clientId,
      documentTypeCode: params.documentTypeCode,
      expiryStatus: params.expiryStatus,
      q: params.q,
      expiresFrom: params.expiresFrom,
      expiresTo: params.expiresTo,
    });

    const [total, rows] = await Promise.all([
      this.prisma.vehicleDocument.count({ where }),
      this.prisma.vehicleDocument.findMany({
        where,
        include: {
          vehicle: {
            select: {
              registrationNumber: true,
              clientId: true,
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

  async exportCsv(tenantSlug: string, filters: DocumentBrowseFilters): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return '\uFEFFid,vehicleId,registrationNumber,clientId,documentTypeCode,title,expiresOn,fileUrl,fileName,reminderOffsetsDays,createdAt\n';
    }
    const where = documentWhere(tenant.id, filters);
    const rows = await this.prisma.vehicleDocument.findMany({
      where,
      orderBy: [{ expiresOn: 'asc' }, { createdAt: 'desc' }],
      take: MAX_EXPORT_ROWS,
      include: {
        vehicle: { select: { registrationNumber: true, clientId: true } },
      },
    });
    const header =
      'id,vehicleId,registrationNumber,clientId,documentTypeCode,title,expiresOn,fileUrl,fileName,reminderOffsetsDays,createdAt';
    const lines = rows.map((r) =>
      [
        r.id,
        r.vehicleId,
        r.vehicle.registrationNumber,
        r.vehicle.clientId,
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

  async getById(tenantSlug: string, id: string) {
    const row = await this.prisma.vehicleDocument.findFirst({
      where: { id, vehicle: { tenant: { slug: tenantSlug } } },
      include: {
        vehicle: {
          select: {
            registrationNumber: true,
            clientId: true,
            tenant: { select: { slug: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Document not found');
    return toDocRow(row);
  }

  async create(tenantSlug: string, dto: CreateDocumentInput, actorUserId?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
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
        reminderOffsetsDays: reminderOffsetsForDb(reminderOffsets),
      },
      include: {
        vehicle: {
          select: {
            registrationNumber: true,
            clientId: true,
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

    if (dto.syncReminderAction !== false) {
      await this.reminders.syncFromDocument(tenant.id, {
        id: row.id,
        vehicleId: row.vehicleId,
        title: row.title,
        expiresOn: row.expiresOn,
        reminderOffsetsDays: row.reminderOffsetsDays,
      });
    }

    return toDocRow(row);
  }

  async patch(tenantSlug: string, id: string, dto: PatchDocumentInput, actorUserId?: string) {
    if (dto.vehicleId) {
      await assertVehicleInTenant(this.prisma, tenantSlug, dto.vehicleId);
    }

    const before = await this.prisma.vehicleDocument.findFirst({
      where: { id, vehicle: { tenant: { slug: tenantSlug } } },
      include: { vehicle: { select: { registrationNumber: true, tenantId: true } } },
    });
    if (!before) throw new NotFoundException('Document not found');

    const row = await this.prisma.vehicleDocument.update({
      where: { id },
      data: {
        vehicleId: dto.vehicleId,
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
        reminderOffsetsDays: reminderOffsetsForDb(dto.reminderOffsetsDays),
      },
      include: {
        vehicle: {
          select: {
            registrationNumber: true,
            clientId: true,
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

    if (dto.syncReminderAction !== false) {
      await this.reminders.syncFromDocument(before.vehicle.tenantId, {
        id: row.id,
        vehicleId: row.vehicleId,
        title: row.title,
        expiresOn: row.expiresOn,
        reminderOffsetsDays: row.reminderOffsetsDays,
      });
    }

    return toDocRow(row);
  }

  async delete(tenantSlug: string, id: string, actorUserId?: string) {
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
