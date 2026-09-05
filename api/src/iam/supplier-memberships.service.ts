import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

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
        user: { select: { email: true, displayName: true } },
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
      role: r.role,
      createdAt: r.createdAt.toISOString(),
    }));
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
}
