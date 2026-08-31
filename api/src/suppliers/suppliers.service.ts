import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SupplierCategory, SupplierStatus, MaintenanceWorkOrderStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AccessContext } from '../iam/access-context.types';
import {
  assertPartnerSupplierId,
  assertPartnerWrite,
  isPartnerUser,
} from '../iam/partner-access';
import { PrismaService } from '../prisma/prisma.service';
import { escapeCsvCell } from '../ops/ops-csv';
import { parseSupplierServiceCodes, supplierServiceCatalog } from './supplier-services';
import {
  assertSupplierReadById,
  supplierListScope,
} from './supplier-access';

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
  services: string[];
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
  services?: string[];
  /** La creare: alocă imediat la acești clienți (UAT-011). */
  clientIds?: string[];
};

export type PatchSupplierInput = Partial<CreateSupplierInput>;

export type SupplierListParams = {
  page: number;
  pageSize: number;
  q?: string;
  status?: SupplierStatus;
  category?: SupplierCategory;
  serviceTypeCode?: string;
};

export type SupplierStats = {
  total: number;
  active: number;
  inactive: number;
  blocked: number;
  openWorkOrders: number;
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

  private listWhere(
    tenantId: string,
    params: SupplierListParams,
    access?: AccessContext,
  ): Prisma.SupplierWhereInput {
    const parts: Prisma.SupplierWhereInput[] = [{ tenantId }];
    const scope = access ? supplierListScope(access) : undefined;
    if (scope) parts.push(scope);
    if (params.status) parts.push({ status: params.status });
    if (params.category) parts.push({ category: params.category });
    if (params.serviceTypeCode) {
      parts.push({
        serviceOfferings: { some: { serviceType: { code: params.serviceTypeCode.trim() } } },
      });
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
    services: string[] = [],
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
      services,
      workOrderCount,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getServiceCatalog(tenantSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) return supplierServiceCatalog();

    const rows = await this.prisma.tenantServiceType.findMany({
      where: { tenantId: tenant.id, active: true },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });

    if (rows.length === 0) return supplierServiceCatalog();

    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      kind: r.code,
      label: r.label,
      description: r.clientDescription,
    }));
  }

  private async resolveServiceTypeIds(tenantId: string, codes: string[]) {
    if (codes.length === 0) return [] as { id: string; code: string }[];
    const types = await this.prisma.tenantServiceType.findMany({
      where: { tenantId, active: true, code: { in: codes } },
      select: { id: true, code: true },
    });
    if (types.length !== codes.length) {
      throw new BadRequestException('Invalid or inactive service type code');
    }
    return types;
  }

  private offeringInclude() {
    return {
      serviceOfferings: {
        orderBy: { serviceType: { sortOrder: 'asc' as const } },
        select: { serviceType: { select: { code: true } } },
      },
    } as const;
  }

  async listPaged(tenantSlug: string, params: SupplierListParams, access?: AccessContext) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return { items: [], total: 0, page: params.page, pageSize: params.pageSize };
    }
    const pageSize = Math.min(Math.max(1, params.pageSize), MAX_PAGE_SIZE);
    const page = Math.max(1, params.page);
    const skip = (page - 1) * pageSize;
    const where = this.listWhere(tenant.id, params, access);

    const [total, rows] = await Promise.all([
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.findMany({
        where,
        orderBy: [{ status: 'asc' }, { code: 'asc' }],
        skip,
        take: pageSize,
        include: {
          _count: { select: { workOrders: true } },
          ...this.offeringInclude(),
        },
      }),
    ]);

    return {
      items: rows.map((r) =>
        this.toRecord(
          r,
          r._count.workOrders,
          r.serviceOfferings.map((s) => s.serviceType.code),
        ),
      ),
      total,
      page,
      pageSize,
    };
  }

  async getStats(
    tenantSlug: string,
    params: Omit<SupplierListParams, 'page' | 'pageSize'>,
    access?: AccessContext,
  ): Promise<SupplierStats> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return { total: 0, active: 0, inactive: 0, blocked: 0, openWorkOrders: 0 };
    }

    const where = this.listWhere(tenant.id, { ...params, page: 1, pageSize: 1 }, access);

    const [total, active, inactive, blocked, matchingIds] = await Promise.all([
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.count({ where: { AND: [where, { status: SupplierStatus.active }] } }),
      this.prisma.supplier.count({ where: { AND: [where, { status: SupplierStatus.inactive }] } }),
      this.prisma.supplier.count({ where: { AND: [where, { status: SupplierStatus.blocked }] } }),
      this.prisma.supplier.findMany({ where, select: { id: true } }),
    ]);

    const supplierIds = matchingIds.map((s) => s.id);
    const openWorkOrders =
      supplierIds.length === 0
        ? 0
        : await this.prisma.maintenanceWorkOrder.count({
            where: {
              tenantId: tenant.id,
              supplierId: { in: supplierIds },
              status: {
                notIn: [MaintenanceWorkOrderStatus.done, MaintenanceWorkOrderStatus.cancelled],
              },
            },
          });

    return { total, active, inactive, blocked, openWorkOrders };
  }

  async getById(tenantSlug: string, id: string, access?: AccessContext): Promise<SupplierRecord> {
    if (access) {
      await assertSupplierReadById(this.prisma, tenantSlug, id, access);
    }
    const row = await this.findRow(tenantSlug, id);
    const [woCount, offerings] = await Promise.all([
      this.prisma.maintenanceWorkOrder.count({
        where: { supplierId: id, tenant: { slug: tenantSlug } },
      }),
      this.prisma.supplierService.findMany({
        where: { supplierId: id },
        orderBy: { serviceType: { sortOrder: 'asc' } },
        select: { serviceType: { select: { code: true } } },
      }),
    ]);
    return this.toRecord(
      row,
      woCount,
      offerings.map((o) => o.serviceType.code),
    );
  }

  async setServices(
    tenantSlug: string,
    id: string,
    rawServices: unknown,
    actorUserId?: string,
    access?: AccessContext,
  ): Promise<SupplierRecord> {
    const codes = parseSupplierServiceCodes(rawServices);
    if (access && isPartnerUser(access)) {
      assertPartnerSupplierId(access, id);
      assertPartnerWrite(access);
    }
    const row = await this.findRow(tenantSlug, id);
    const types = await this.resolveServiceTypeIds(row.tenantId, codes);

    await this.prisma.$transaction(async (tx) => {
      await tx.supplierService.deleteMany({ where: { supplierId: id, tenantId: row.tenantId } });
      if (types.length > 0) {
        await tx.supplierService.createMany({
          data: types.map((t) => ({
            tenantId: row.tenantId,
            supplierId: id,
            serviceTypeId: t.id,
          })),
        });
      }
    });

    await this.audit.log({
      tenantId: row.tenantId,
      actorUserId,
      action: 'supplier.set_services',
      entityType: 'supplier',
      entityId: id,
      meta: { services: codes },
    });

    return this.getById(tenantSlug, id, access);
  }

  async create(tenantSlug: string, dto: CreateSupplierInput, actorUserId?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const code = normalizeCode(dto.code);
    const legalName = dto.legalName?.trim();
    if (!legalName) throw new BadRequestException('legalName is required');

    const uniqueClientIds = [
      ...new Set((dto.clientIds ?? []).map((id) => id.trim()).filter(Boolean)),
    ];
    if (uniqueClientIds.length) {
      const found = await this.prisma.client.findMany({
        where: { id: { in: uniqueClientIds }, tenantId: tenant.id },
        select: { id: true },
      });
      if (found.length !== uniqueClientIds.length) {
        throw new BadRequestException('One or more clients are invalid');
      }
    }

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
      if (dto.services?.length) {
        const codes = parseSupplierServiceCodes(dto.services);
        const types = await this.resolveServiceTypeIds(tenant.id, codes);
        if (types.length > 0) {
          await this.prisma.supplierService.createMany({
            data: types.map((t) => ({
              tenantId: tenant.id,
              supplierId: row.id,
              serviceTypeId: t.id,
            })),
          });
        }
      }
      if (uniqueClientIds.length) {
        await this.prisma.clientSupplierAllocation.createMany({
          data: uniqueClientIds.map((clientId) => ({
            tenantId: tenant.id,
            clientId,
            supplierId: row.id,
          })),
        });
      }
      await this.audit.log({
        tenantId: tenant.id,
        actorUserId,
        action: 'supplier.create',
        entityType: 'supplier',
        entityId: row.id,
        meta: { code: row.code },
      });
      return this.getById(tenantSlug, row.id);
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

    const serviceCodes =
      dto.services !== undefined ? parseSupplierServiceCodes(dto.services) : undefined;

    try {
      if (Object.keys(data).length > 0) {
        await this.prisma.supplier.update({ where: { id }, data });
      }
      if (serviceCodes !== undefined) {
        const types = await this.resolveServiceTypeIds(before.tenantId, serviceCodes);
        await this.prisma.$transaction(async (tx) => {
          await tx.supplierService.deleteMany({ where: { supplierId: id, tenantId: before.tenantId } });
          if (types.length > 0) {
            await tx.supplierService.createMany({
              data: types.map((t) => ({
                tenantId: before.tenantId,
                supplierId: id,
                serviceTypeId: t.id,
              })),
            });
          }
        });
        await this.audit.log({
          tenantId: before.tenantId,
          actorUserId,
          action: 'supplier.set_services',
          entityType: 'supplier',
          entityId: id,
          meta: { services: serviceCodes },
        });
      }
      await this.audit.log({
        tenantId: before.tenantId,
        actorUserId,
        action: 'supplier.patch',
        entityType: 'supplier',
        entityId: id,
      });
      return this.getById(tenantSlug, id);
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
