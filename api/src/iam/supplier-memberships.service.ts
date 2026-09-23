import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MembershipRole, SupplierRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

export type CreateSupplierMembershipInput = {
  email: string;
  displayName?: string | null;
  password: string;
  supplierId: string;
  role: SupplierRole | string;
};

@Injectable()
export class SupplierMembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) return [];

    const rows = await this.prisma.supplierMembership.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ supplier: { code: 'asc' } }, { user: { email: 'asc' } }],
      include: {
        supplier: { select: { code: true, legalName: true } },
        user: { select: { email: true, displayName: true, disabledAt: true } },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      supplierId: r.supplierId,
      supplierCode: r.supplier.code,
      supplierLegalName: r.supplier.legalName,
      userId: r.userId,
      email: r.user.email,
      displayName: r.user.displayName,
      disabledAt: r.user.disabledAt?.toISOString() ?? null,
      role: r.role,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async create(
    tenantSlug: string,
    dto: CreateSupplierMembershipInput,
    actorUserId?: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const email = dto.email?.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new BadRequestException('email is required');
    }
    const password = dto.password?.trim() ?? '';
    if (password.length < 10) {
      throw new BadRequestException('password must be at least 10 characters');
    }

    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, tenantId: tenant.id },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const role = this.parseRole(dto.role);
    const passwordHash = await bcrypt.hash(password, 12);
    const displayName = dto.displayName?.trim() || email.split('@')[0];

    const user = await this.prisma.user.upsert({
      where: { email },
      create: { email, passwordHash, displayName },
      update: { passwordHash, displayName },
    });

    await this.prisma.tenantMembership.upsert({
      where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
      create: { userId: user.id, tenantId: tenant.id, role: MembershipRole.supplier_user },
      update: { role: MembershipRole.supplier_user },
    });

    const row = await this.prisma.supplierMembership.upsert({
      where: {
        userId_tenantId_supplierId: {
          userId: user.id,
          tenantId: tenant.id,
          supplierId: supplier.id,
        },
      },
      create: {
        tenantId: tenant.id,
        supplierId: supplier.id,
        userId: user.id,
        role,
      },
      update: { role },
      include: {
        supplier: { select: { code: true, legalName: true } },
        user: { select: { email: true, displayName: true } },
      },
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'supplier_membership.create',
      entityType: 'supplier_membership',
      entityId: row.id,
      meta: { email, supplierCode: supplier.code, role },
    });

    return {
      id: row.id,
      supplierId: row.supplierId,
      supplierCode: row.supplier.code,
      userId: row.userId,
      email: row.user.email,
      role: row.role,
    };
  }

  async remove(tenantSlug: string, id: string, actorUserId?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const existing = await this.prisma.supplierMembership.findFirst({
      where: { id, tenantId: tenant.id },
    });
    if (!existing) throw new NotFoundException('Supplier membership not found');

    await this.prisma.supplierMembership.delete({ where: { id } });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      action: 'supplier_membership.delete',
      entityType: 'supplier_membership',
      entityId: id,
      meta: { userId: existing.userId, supplierId: existing.supplierId },
    });
  }

  private parseRole(raw: SupplierRole | string | undefined): SupplierRole {
    if (raw === SupplierRole.supplier_manager || raw === 'supplier_manager') {
      return SupplierRole.supplier_manager;
    }
    if (raw === SupplierRole.supplier_accountant || raw === 'supplier_accountant') {
      return SupplierRole.supplier_accountant;
    }
    return SupplierRole.supplier_staff;
  }
}
