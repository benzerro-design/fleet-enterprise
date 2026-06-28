import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

const CLIENT_DOCUMENT_TYPES = new Set([
  'cui',
  'certificat_inregistrare',
  'autorizatie',
  'contract',
  'altele',
]);

export type ClientContactRecord = {
  id: string;
  clientId: string;
  fullName: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ClientDocumentRecord = {
  id: string;
  clientId: string;
  documentTypeCode: string;
  title: string;
  fileUrl: string;
  fileName: string | null;
  expiresOn: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateClientContactInput = {
  fullName: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  isPrimary?: boolean;
};

export type PatchClientContactInput = Partial<CreateClientContactInput>;

export type CreateClientDocumentInput = {
  documentTypeCode: string;
  title: string;
  fileUrl: string;
  fileName?: string | null;
  expiresOn?: string | null;
  notes?: string | null;
};

export type PatchClientDocumentInput = Partial<CreateClientDocumentInput>;

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
  if (!CLIENT_DOCUMENT_TYPES.has(t)) {
    throw new BadRequestException(`documentTypeCode must be one of: ${[...CLIENT_DOCUMENT_TYPES].join(', ')}`);
  }
  return t;
}

@Injectable()
export class ClientAttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listContacts(tenantSlug: string, clientId: string): Promise<ClientContactRecord[]> {
    await this.ensureClient(tenantSlug, clientId);
    const rows = await this.prisma.clientContact.findMany({
      where: { clientId },
      orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { fullName: 'asc' }],
    });
    return rows.map((r) => this.toContactRecord(r));
  }

  async createContact(
    tenantSlug: string,
    clientId: string,
    input: CreateClientContactInput,
    actorUserId?: string,
  ): Promise<ClientContactRecord> {
    const { tenant, client } = await this.ensureClient(tenantSlug, clientId);
    const fullName = input.fullName?.trim();
    if (!fullName) throw new BadRequestException('fullName is required');

    if (input.isPrimary) {
      await this.prisma.clientContact.updateMany({
        where: { clientId },
        data: { isPrimary: false },
      });
    }

    const maxSort = await this.prisma.clientContact.aggregate({
      where: { clientId },
      _max: { sortOrder: true },
    });

    const row = await this.prisma.clientContact.create({
      data: {
        tenantId: tenant.id,
        clientId: client.id,
        fullName,
        role: input.role?.trim() || null,
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        isPrimary: input.isPrimary ?? false,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'client_contact.create',
      entityType: 'client_contact',
      entityId: row.id,
      meta: { clientId: client.id, fullName: row.fullName },
    });

    return this.toContactRecord(row);
  }

  async patchContact(
    tenantSlug: string,
    clientId: string,
    contactId: string,
    input: PatchClientContactInput,
    actorUserId?: string,
  ): Promise<ClientContactRecord> {
    const { tenant } = await this.ensureClient(tenantSlug, clientId);
    const existing = await this.findContact(clientId, contactId);

    if (input.fullName !== undefined && !input.fullName.trim()) {
      throw new BadRequestException('fullName cannot be empty');
    }

    if (input.isPrimary) {
      await this.prisma.clientContact.updateMany({
        where: { clientId, NOT: { id: contactId } },
        data: { isPrimary: false },
      });
    }

    const row = await this.prisma.clientContact.update({
      where: { id: existing.id },
      data: {
        ...(input.fullName !== undefined ? { fullName: input.fullName.trim() } : {}),
        ...(input.role !== undefined ? { role: input.role?.trim() || null } : {}),
        ...(input.email !== undefined ? { email: input.email?.trim() || null } : {}),
        ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
        ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
      },
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'client_contact.update',
      entityType: 'client_contact',
      entityId: row.id,
      meta: { clientId },
    });

    return this.toContactRecord(row);
  }

  async deleteContact(
    tenantSlug: string,
    clientId: string,
    contactId: string,
    actorUserId?: string,
  ): Promise<void> {
    const { tenant } = await this.ensureClient(tenantSlug, clientId);
    const existing = await this.findContact(clientId, contactId);
    await this.prisma.clientContact.delete({ where: { id: existing.id } });
    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'client_contact.delete',
      entityType: 'client_contact',
      entityId: contactId,
      meta: { clientId },
    });
  }

  async listDocuments(tenantSlug: string, clientId: string): Promise<ClientDocumentRecord[]> {
    await this.ensureClient(tenantSlug, clientId);
    const rows = await this.prisma.clientDocument.findMany({
      where: { clientId },
      orderBy: [{ createdAt: 'desc' }],
    });
    return rows.map((r) => this.toDocumentRecord(r));
  }

  async createDocument(
    tenantSlug: string,
    clientId: string,
    input: CreateClientDocumentInput,
    actorUserId?: string,
  ): Promise<ClientDocumentRecord> {
    const { tenant, client } = await this.ensureClient(tenantSlug, clientId);
    const documentTypeCode = assertDocumentType(input.documentTypeCode);
    const title = input.title?.trim();
    const fileUrl = input.fileUrl?.trim();
    if (!title) throw new BadRequestException('title is required');
    if (!fileUrl) throw new BadRequestException('fileUrl is required');

    const row = await this.prisma.clientDocument.create({
      data: {
        tenantId: tenant.id,
        clientId: client.id,
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
      action: 'client_document.create',
      entityType: 'client_document',
      entityId: row.id,
      meta: { clientId: client.id, title: row.title },
    });

    return this.toDocumentRecord(row);
  }

  async patchDocument(
    tenantSlug: string,
    clientId: string,
    documentId: string,
    input: PatchClientDocumentInput,
    actorUserId?: string,
  ): Promise<ClientDocumentRecord> {
    const { tenant } = await this.ensureClient(tenantSlug, clientId);
    const existing = await this.findDocument(clientId, documentId);

    const row = await this.prisma.clientDocument.update({
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
      action: 'client_document.update',
      entityType: 'client_document',
      entityId: row.id,
      meta: { clientId },
    });

    return this.toDocumentRecord(row);
  }

  async deleteDocument(
    tenantSlug: string,
    clientId: string,
    documentId: string,
    actorUserId?: string,
  ): Promise<void> {
    const { tenant } = await this.ensureClient(tenantSlug, clientId);
    const existing = await this.findDocument(clientId, documentId);
    await this.prisma.clientDocument.delete({ where: { id: existing.id } });
    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'client_document.delete',
      entityType: 'client_document',
      entityId: documentId,
      meta: { clientId },
    });
  }

  private async ensureClient(tenantSlug: string, clientId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId: tenant.id },
    });
    if (!client) throw new NotFoundException('Client not found');
    return { tenant, client };
  }

  private async findContact(clientId: string, contactId: string) {
    const row = await this.prisma.clientContact.findFirst({
      where: { id: contactId, clientId },
    });
    if (!row) throw new NotFoundException('Contact not found');
    return row;
  }

  private async findDocument(clientId: string, documentId: string) {
    const row = await this.prisma.clientDocument.findFirst({
      where: { id: documentId, clientId },
    });
    if (!row) throw new NotFoundException('Document not found');
    return row;
  }

  private toContactRecord(row: {
    id: string;
    clientId: string;
    fullName: string;
    role: string | null;
    email: string | null;
    phone: string | null;
    isPrimary: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }): ClientContactRecord {
    return {
      id: row.id,
      clientId: row.clientId,
      fullName: row.fullName,
      role: row.role,
      email: row.email,
      phone: row.phone,
      isPrimary: row.isPrimary,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toDocumentRecord(row: {
    id: string;
    clientId: string;
    documentTypeCode: string;
    title: string;
    fileUrl: string;
    fileName: string | null;
    expiresOn: Date | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): ClientDocumentRecord {
    return {
      id: row.id,
      clientId: row.clientId,
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
