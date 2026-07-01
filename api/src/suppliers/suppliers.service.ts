import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SupplierCategory, SupplierStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { escapeCsvCell } from '../ops/ops-csv';

const MAX_PAGE_SIZE = 200;

export type SupplierRecord = {
  id: string;
  code: string;
  legalName: string;
  taxId: string | null;
  category: SupplierCategory;
  status: SupplierStatus;
  contactEmail: string | null;
  contactPhone: string | null;
  addressLine: string | null;
  city: string | null;
  county: string | null;
  notes: string | null;
  workOrderCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateSupplierInput = {
  code: string;
  legalName: string;
  taxId?: string | null;
  category?: SupplierCategory;
  status?: SupplierStatus;
  contactEmail?: string | null;
  contactPhone?: string | null;
  addressLine?: string | null;
  city?: string | null;
  county?: string | null;
  notes?: string | null;
};

export type PatchSupplierInput = Partial<CreateSupplierInput>;

export type SupplierListParams = {
  page: number;
  pageSize: number;
  q?: string;
  status?: SupplierStatus;
  category?: SupplierCategory;
};

function normalizeCode(code: string): string {
  const t = code.trim();
  if (!t) throw new BadRequestException('code is required');
  if (t.length > 64) throw new BadRequestException('code too long');
  return t;
}

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private listWhere(tenantId: string, params: SupplierListParams): Prisma.SupplierWhereInput {
    const parts: Prisma.SupplierWhereInput[] = [{ tenantId }];
    if (params.status) parts.push({ status: params.status });
    if (params.category) parts.push({ category: params.category });
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

  private toRecord(
    row: {
      id: string;
      code: string;
      legalName: string;
      taxId: string | null;
      category: SupplierCategory;
      status: SupplierStatus;
      contactEmail: string | null;
      contactPhone: string | null;
      addressLine: string | null;
      city: string | null;
      county: string | null;
      notes: string | null;
      createdAt: Date;
      updatedAt: Date;
    },
    workOrderCount = 0,
  ): SupplierRecord {
    return {
      id: row.id,
      code: row.code,
      legalName: row.legalName,
      taxId: row.taxId,
      category: row.category,
      status: row.status,
      contactEmail: row.contactEmail,
      contactPhone: row.contactPhone,
      addressLine: row.addressLine,
      city: row.city,
      county: row.county,
      notes: row.notes,
      workOrderCount,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listPaged(tenantSlug: string, params: SupplierListParams) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return { items: [], total: 0, page: params.page, pageSize: params.pageSize };
    }
    const pageSize = Math.min(Math.max(1, params.pageSize), MAX_PAGE_SIZE);
    const page = Math.max(1, params.page);
    const skip = (page - 1) * pageSize;
    const where = this.listWhere(tenant.id, params);

    const [total, rows] = await Promise.all([
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.findMany({
        where,
        orderBy: [{ status: 'asc' }, { code: 'asc' }],
        skip,
        take: pageSize,
        include: { _count: { select: { workOrders: true } } },
      }),
    ]);

    return {
      items: rows.map((r) => this.toRecord(r, r._count.workOrders)),
      total,
      page,
      pageSize,
    };
  }

  async getById(tenantSlug: string, id: string): Promise<SupplierRecord> {
    const row = await this.findRow(tenantSlug, id);
    const woCount = await this.prisma.maintenanceWorkOrder.count({
      where: { supplierId: id, tenant: { slug: tenantSlug } },
    });
    return this.toRecord(row, woCount);
  }

  async create(tenantSlug: string, dto: CreateSupplierInput, actorUserId?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const code = normalizeCode(dto.code);
    const legalName = dto.legalName?.trim();
    if (!legalName) throw new BadRequestException('legalName is required');

    try {
      const row = await this.prisma.supplier.create({
        data: {
          tenantId: tenant.id,
          code,
          legalName,
          taxId: dto.taxId?.trim() || null,
          category: dto.category ?? SupplierCategory.other,
          status: dto.status ?? SupplierStatus.active,
          contactEmail: dto.contactEmail?.trim() || null,
          contactPhone: dto.contactPhone?.trim() || null,
          addressLine: dto.addressLine?.trim() || null,
          city: dto.city?.trim() || null,
          county: dto.county?.trim() || null,
          notes: dto.notes?.trim() || null,
        },
      });
      await this.audit.log({
        tenantId: tenant.id,
        actorUserId,
        action: 'supplier.create',
        entityType: 'supplier',
        entityId: row.id,
        meta: { code: row.code },
      });
      return this.toRecord(row);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Supplier code already exists');
      }
      throw e;
    }
  }

  async patch(tenantSlug: string, id: string, dto: PatchSupplierInput, actorUserId?: string) {
    const before = await this.findRow(tenantSlug, id);
    const data: Prisma.SupplierUpdateInput = {};
    if (dto.code !== undefined) data.code = normalizeCode(dto.code);
    if (dto.legalName !== undefined) {
      const n = dto.legalName.trim();
      if (!n) throw new BadRequestException('legalName cannot be empty');
      data.legalName = n;
    }
    if (dto.taxId !== undefined) data.taxId = dto.taxId?.trim() || null;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.contactEmail !== undefined) data.contactEmail = dto.contactEmail?.trim() || null;
    if (dto.contactPhone !== undefined) data.contactPhone = dto.contactPhone?.trim() || null;
    if (dto.addressLine !== undefined) data.addressLine = dto.addressLine?.trim() || null;
    if (dto.city !== undefined) data.city = dto.city?.trim() || null;
    if (dto.county !== undefined) data.county = dto.county?.trim() || null;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;

    try {
      const row = await this.prisma.supplier.update({ where: { id }, data });
      await this.audit.log({
        tenantId: before.tenantId,
        actorUserId,
        action: 'supplier.patch',
        entityType: 'supplier',
        entityId: id,
      });
      return this.getById(tenantSlug, row.id);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Supplier code already exists');
      }
      throw e;
    }
  }

  async exportCsv(tenantSlug: string, params: Omit<SupplierListParams, 'page' | 'pageSize'>) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) return '\uFEFFcode,legalName,taxId,category,status\n';
    const rows = await this.prisma.supplier.findMany({
      where: this.listWhere(tenant.id, { ...params, page: 1, pageSize: MAX_PAGE_SIZE }),
      orderBy: [{ code: 'asc' }],
      take: MAX_PAGE_SIZE,
    });
    const header = 'code,legalName,taxId,category,status,contactEmail,contactPhone,city';
    const lines = rows.map((r) =>
      [
        escapeCsvCell(r.code),
        escapeCsvCell(r.legalName),
        escapeCsvCell(r.taxId ?? ''),
        r.category,
        r.status,
        escapeCsvCell(r.contactEmail ?? ''),
        escapeCsvCell(r.contactPhone ?? ''),
        escapeCsvCell(r.city ?? ''),
      ].join(','),
    );
    return `\uFEFF${header}\n${lines.join('\n')}\n`;
  }

  private async findRow(tenantSlug: string, id: string) {
    const row = await this.prisma.supplier.findFirst({
      where: { id, tenant: { slug: tenantSlug } },
    });
    if (!row) throw new NotFoundException('Supplier not found');
    return row;
  }
}
