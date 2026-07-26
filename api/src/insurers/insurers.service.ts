import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AccessContext } from '../iam/access-context.types';
import { isPartnerUser } from '../iam/partner-access';
import { PrismaService } from '../prisma/prisma.service';

const MAX_PAGE_SIZE = 200;

export type InsurerRecord = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateInsurerInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  active?: boolean;
};

export type PatchInsurerInput = Partial<CreateInsurerInput>;

export type InsurerListParams = {
  page: number;
  pageSize: number;
  q?: string;
  active?: boolean;
};

@Injectable()
export class InsurersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async tenantId(slug: string): Promise<string> {
    const t = await this.prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
    if (!t) throw new NotFoundException('Tenant not found');
    return t.id;
  }

  private toRecord(row: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    notes: string | null;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): InsurerRecord {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      notes: row.notes,
      active: row.active,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private assertAccess(access?: AccessContext) {
    if (!access) return;
    if (isPartnerUser(access)) {
      throw new ForbiddenException('Partners cannot manage insurers catalog');
    }
  }

  async list(tenantSlug: string, params: InsurerListParams, access?: AccessContext) {
    this.assertAccess(access);
    const tenantId = await this.tenantId(tenantSlug);
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, params.pageSize || 50));
    const where: Prisma.InsurerWhereInput = { tenantId };
    if (params.active !== undefined) where.active = params.active;
    const q = params.q?.trim();
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }
    const [total, rows] = await Promise.all([
      this.prisma.insurer.count({ where }),
      this.prisma.insurer.findMany({
        where,
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items: rows.map((r) => this.toRecord(r)), total, page, pageSize };
  }

  async getById(tenantSlug: string, id: string, access?: AccessContext) {
    this.assertAccess(access);
    const tenantId = await this.tenantId(tenantSlug);
    const row = await this.prisma.insurer.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Insurer not found');
    return this.toRecord(row);
  }

  async create(
    tenantSlug: string,
    dto: CreateInsurerInput,
    actorUserId?: string | null,
    access?: AccessContext,
  ) {
    this.assertAccess(access);
    const tenantId = await this.tenantId(tenantSlug);
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('name is required');
    const email = dto.email?.trim() || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('email is invalid');
    }
    try {
      const row = await this.prisma.insurer.create({
        data: {
          tenantId,
          name,
          email,
          phone: dto.phone?.trim() || null,
          notes: dto.notes?.trim() || null,
          active: dto.active !== false,
        },
      });
      await this.audit.log({
        tenantId,
        actorUserId,
        action: 'insurer.create',
        entityType: 'insurer',
        entityId: row.id,
        meta: { name: row.name },
      });
      return this.toRecord(row);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Insurer with this name already exists');
      }
      throw e;
    }
  }

  async patch(
    tenantSlug: string,
    id: string,
    dto: PatchInsurerInput,
    actorUserId?: string | null,
    access?: AccessContext,
  ) {
    this.assertAccess(access);
    const tenantId = await this.tenantId(tenantSlug);
    const existing = await this.prisma.insurer.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Insurer not found');

    const data: Prisma.InsurerUpdateInput = {};
    if (dto.name !== undefined) {
      const name = dto.name?.trim();
      if (!name) throw new BadRequestException('name is required');
      data.name = name;
    }
    if (dto.email !== undefined) {
      const email = dto.email?.trim() || null;
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new BadRequestException('email is invalid');
      }
      data.email = email;
    }
    if (dto.phone !== undefined) data.phone = dto.phone?.trim() || null;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;
    if (dto.active !== undefined) data.active = dto.active === true;

    try {
      const row = await this.prisma.insurer.update({ where: { id }, data });
      await this.audit.log({
        tenantId,
        actorUserId,
        action: 'insurer.patch',
        entityType: 'insurer',
        entityId: id,
        meta: dto,
      });
      return this.toRecord(row);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Insurer with this name already exists');
      }
      throw e;
    }
  }
}
