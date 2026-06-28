import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

const DRIVER_DOCUMENT_TYPES = new Set([
  'permis',
  'adr',
  'medicina_muncii',
  'atestat',
  'altele',
]);

export type DriverDocumentRecord = {
  id: string;
  driverId: string;
  documentTypeCode: string;
  title: string;
  fileUrl: string;
  fileName: string | null;
  expiresOn: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateDriverDocumentInput = {
  documentTypeCode: string;
  title: string;
  fileUrl: string;
  fileName?: string | null;
  expiresOn?: string | null;
  notes?: string | null;
};

export type PatchDriverDocumentInput = Partial<CreateDriverDocumentInput>;

function parseOptionalDate(raw: string | null | undefined): Date | null {
  if (!raw?.trim()) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException('expiresOn invalid');
  }
  return d;
}

function assertDocumentType(code: string): string {
  const t = code.trim();
  if (!DRIVER_DOCUMENT_TYPES.has(t)) {
    throw new BadRequestException(
      `documentTypeCode must be one of: ${[...DRIVER_DOCUMENT_TYPES].join(', ')}`,
    );
  }
  return t;
}

@Injectable()
export class DriverAttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listDocuments(tenantSlug: string, driverId: string): Promise<DriverDocumentRecord[]> {
    await this.ensureDriver(tenantSlug, driverId);
    const rows = await this.prisma.driverDocument.findMany({
      where: { driverId },
      orderBy: [{ createdAt: 'desc' }],
    });
    return rows.map((r) => this.toDocumentRecord(r));
  }

  async createDocument(
    tenantSlug: string,
    driverId: string,
    input: CreateDriverDocumentInput,
    actorUserId?: string,
  ): Promise<DriverDocumentRecord> {
    const { tenant, driver } = await this.ensureDriver(tenantSlug, driverId);
    const documentTypeCode = assertDocumentType(input.documentTypeCode);
    const title = input.title?.trim();
    const fileUrl = input.fileUrl?.trim();
    if (!title) throw new BadRequestException('title is required');
    if (!fileUrl) throw new BadRequestException('fileUrl is required');

    const row = await this.prisma.driverDocument.create({
      data: {
        tenantId: tenant.id,
        driverId: driver.id,
        documentTypeCode,
        title,
        fileUrl,
        fileName: input.fileName?.trim() || null,
        expiresOn: parseOptionalDate(input.expiresOn),
        notes: input.notes?.trim() || null,
      },
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'driver_document.create',
      entityType: 'driver_document',
      entityId: row.id,
      meta: { driverId: driver.id, title: row.title },
    });

    return this.toDocumentRecord(row);
  }

  async patchDocument(
    tenantSlug: string,
    driverId: string,
    documentId: string,
    input: PatchDriverDocumentInput,
    actorUserId?: string,
  ): Promise<DriverDocumentRecord> {
    const { tenant } = await this.ensureDriver(tenantSlug, driverId);
    const existing = await this.findDocument(driverId, documentId);

    const row = await this.prisma.driverDocument.update({
      where: { id: existing.id },
      data: {
        ...(input.documentTypeCode !== undefined
          ? { documentTypeCode: assertDocumentType(input.documentTypeCode) }
          : {}),
        ...(input.title !== undefined ? { title: input.title.trim() || existing.title } : {}),
        ...(input.fileUrl !== undefined ? { fileUrl: input.fileUrl.trim() || existing.fileUrl } : {}),
        ...(input.fileName !== undefined ? { fileName: input.fileName?.trim() || null } : {}),
        ...(input.expiresOn !== undefined ? { expiresOn: parseOptionalDate(input.expiresOn) } : {}),
        ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      },
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'driver_document.update',
      entityType: 'driver_document',
      entityId: row.id,
      meta: { driverId },
    });

    return this.toDocumentRecord(row);
  }

  async deleteDocument(
    tenantSlug: string,
    driverId: string,
    documentId: string,
    actorUserId?: string,
  ): Promise<void> {
    const { tenant } = await this.ensureDriver(tenantSlug, driverId);
    const existing = await this.findDocument(driverId, documentId);
    await this.prisma.driverDocument.delete({ where: { id: existing.id } });
    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'driver_document.delete',
      entityType: 'driver_document',
      entityId: documentId,
      meta: { driverId },
    });
  }

  private async ensureDriver(tenantSlug: string, driverId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const driver = await this.prisma.driver.findFirst({
      where: { id: driverId, tenantId: tenant.id },
    });
    if (!driver) throw new NotFoundException('Driver not found');
    return { tenant, driver };
  }

  private async findDocument(driverId: string, documentId: string) {
    const row = await this.prisma.driverDocument.findFirst({
      where: { id: documentId, driverId },
    });
    if (!row) throw new NotFoundException('Document not found');
    return row;
  }

  private toDocumentRecord(row: {
    id: string;
    driverId: string;
    documentTypeCode: string;
    title: string;
    fileUrl: string;
    fileName: string | null;
    expiresOn: Date | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): DriverDocumentRecord {
    return {
      id: row.id,
      driverId: row.driverId,
      documentTypeCode: row.documentTypeCode,
      title: row.title,
      fileUrl: row.fileUrl,
      fileName: row.fileName,
      expiresOn: row.expiresOn ? row.expiresOn.toISOString() : null,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
