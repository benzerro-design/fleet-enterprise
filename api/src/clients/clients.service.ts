import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClientStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { resolveClientInTenant } from './client-resolve';

const MAX_PAGE_SIZE = 200;

export type ClientRecord = {
  id: string;
  code: string;
  legalName: string;
  taxId: string | null;
  status: ClientStatus;
  notes: string | null;
  vehicleCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateClientInput = {
  code: string;
  legalName: string;
  taxId?: string | null;
  status?: ClientStatus;
  notes?: string | null;
};

export type PatchClientInput = Partial<CreateClientInput>;

export type ClientListParams = {
  page: number;
  pageSize: number;
  q?: string;
  status?: ClientStatus;
};

function normalizeCode(code: string): string {
  const t = code.trim();
  if (!t) throw new BadRequestException('code is required');
  if (t.length > 64) throw new BadRequestException('code too long');
  return t;
}

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listPaged(tenantSlug: string, params: ClientListParams) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return { items: [], total: 0, page: params.page, pageSize: params.pageSize };
    }

    const pageSize = Math.min(Math.max(1, params.pageSize), MAX_PAGE_SIZE);
    const page = Math.max(1, params.page);
    const skip = (page - 1) * pageSize;

    const where = this.listWhere(tenant.id, params);

    const [total, rows] = await Promise.all([
      this.prisma.client.count({ where }),
      this.prisma.client.findMany({
        where,
        orderBy: [{ status: 'asc' }, { code: 'asc' }],
        skip,
        take: pageSize,
        include: { _count: { select: { vehicles: true } } },
      }),
    ]);

    return {
      items: rows.map((r) => this.toRecord(r, r._count.vehicles)),
      total,
      page,
      pageSize,
    };
  }

  async getById(tenantSlug: string, id: string): Promise<ClientRecord> {
    const row = await this.findRow(tenantSlug, id);
    const count = await this.prisma.vehicle.count({
      where: { clientId: row.id, tenant: { slug: tenantSlug } },
    });
    return this.toRecord(row, count);
  }

  async create(
    tenantSlug: string,
    input: CreateClientInput,
    actorUserId?: string,
  ): Promise<ClientRecord> {
    const tenant = await this.ensureTenant(tenantSlug);
    const code = normalizeCode(input.code);
    const legalName = input.legalName?.trim();
    if (!legalName) throw new BadRequestException('legalName is required');

    const existing = await this.prisma.client.findFirst({
      where: { tenantId: tenant.id, code: { equals: code, mode: 'insensitive' } },
    });
    if (existing) {
      throw new ConflictException(`Client code already exists: ${code}`);
    }

    const row = await this.prisma.client.create({
      data: {
        tenantId: tenant.id,
        code,
        legalName,
        taxId: input.taxId?.trim() || null,
        status: input.status ?? ClientStatus.active,
        notes: input.notes?.trim() || null,
      },
      include: { _count: { select: { vehicles: true } } },
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'client.create',
      entityType: 'client',
      entityId: row.id,
      meta: { code: row.code },
    });

    return this.toRecord(row, row._count.vehicles);
  }

  async patch(
    tenantSlug: string,
    id: string,
    input: PatchClientInput,
    actorUserId?: string,
  ): Promise<ClientRecord> {
    const tenant = await this.ensureTenant(tenantSlug);
    const before = await this.findRow(tenantSlug, id);

    let code = before.code;
    if (input.code !== undefined) {
      code = normalizeCode(input.code);
      const dup = await this.prisma.client.findFirst({
        where: {
          tenantId: tenant.id,
          code: { equals: code, mode: 'insensitive' },
          NOT: { id },
        },
      });
      if (dup) throw new ConflictException(`Client code already exists: ${code}`);
    }

    const row = await this.prisma.client.update({
      where: { id },
      data: {
        ...(input.code !== undefined ? { code } : {}),
        ...(input.legalName !== undefined
          ? { legalName: input.legalName.trim() || before.legalName }
          : {}),
        ...(input.taxId !== undefined ? { taxId: input.taxId?.trim() || null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      },
      include: { _count: { select: { vehicles: true } } },
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'client.update',
      entityType: 'client',
      entityId: row.id,
      meta: { code: row.code },
    });

    return this.toRecord(row, row._count.vehicles);
  }

  async delete(tenantSlug: string, id: string, actorUserId?: string): Promise<void> {
    const tenant = await this.ensureTenant(tenantSlug);
    const row = await this.findRow(tenantSlug, id);
    const vehicles = await this.prisma.vehicle.count({ where: { clientId: id } });
    if (vehicles > 0) {
      throw new BadRequestException(
        `Client has ${vehicles} vehicle(s). Reassign vehicles before delete.`,
      );
    }

    await this.prisma.client.delete({ where: { id: row.id } });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'client.delete',
      entityType: 'client',
      entityId: row.id,
      meta: { code: row.code },
    });
  }

  /** For FleetService — resolve API clientId (code or id) to FK. */
  resolveForVehicle(tenantUuid: string, clientInput: string) {
    return resolveClientInTenant(this.prisma, tenantUuid, clientInput);
  }

  private listWhere(tenantUuid: string, params: ClientListParams): Prisma.ClientWhereInput {
    const parts: Prisma.ClientWhereInput[] = [{ tenantId: tenantUuid }];
    if (params.status) {
      parts.push({ status: params.status });
    }
    const q = params.q?.trim();
    if (q) {
      parts.push({
        OR: [
          { code: { contains: q, mode: 'insensitive' } },
          { legalName: { contains: q, mode: 'insensitive' } },
          { taxId: { contains: q, mode: 'insensitive' } },
        ],
      });
    }
    return { AND: parts };
  }

  private async findRow(tenantSlug: string, id: string) {
    const row = await this.prisma.client.findFirst({
      where: { id, tenant: { slug: tenantSlug } },
    });
    if (!row) throw new NotFoundException('Client not found');
    return row;
  }

  private async ensureTenant(slug: string) {
    return this.prisma.tenant.upsert({
      where: { slug },
      create: { slug, name: slug },
      update: { name: slug },
    });
  }

  private toRecord(
    row: {
      id: string;
      code: string;
      legalName: string;
      taxId: string | null;
      status: ClientStatus;
      notes: string | null;
      createdAt: Date;
      updatedAt: Date;
    },
    vehicleCount: number,
  ): ClientRecord {
    return {
      id: row.id,
      code: row.code,
      legalName: row.legalName,
      taxId: row.taxId,
      status: row.status,
      notes: row.notes,
      vehicleCount,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
