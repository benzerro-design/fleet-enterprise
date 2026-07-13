import { ForbiddenException } from '@nestjs/common';
import { MembershipRole, Prisma } from '@prisma/client';
import type { AccessContext } from '../iam/access-context.types';
import { isPartnerUser } from '../iam/partner-access';

export function canWriteSupplier(access: AccessContext): boolean {
  return access.membershipRole === MembershipRole.tenant_admin;
}

export function assertSupplierWrite(access: AccessContext): void {
  if (!canWriteSupplier(access)) {
    throw new ForbiddenException('Only tenant admin can modify suppliers');
  }
}

/** Scope list/read — tenant-wide, partner own supplier, client scoped. */
export function supplierListScope(access: AccessContext): Prisma.SupplierWhereInput | undefined {
  if (access.isTenantWide) return undefined;
  if (isPartnerUser(access)) {
    const ids = access.allowedSupplierIds ?? [];
    if (ids.length === 0) return { id: { in: [] } };
    return { id: { in: ids } };
  }
  if (access.membershipRole === MembershipRole.client_user) {
    const clientIds = access.allowedClientIds ?? [];
    if (clientIds.length === 0) return { id: { in: [] } };
    return {
      OR: [
        { workOrders: { some: { vehicle: { clientId: { in: clientIds } } } } },
        { serviceCases: { some: { clientId: { in: clientIds } } } },
        { serviceAppointments: { some: { vehicle: { clientId: { in: clientIds } } } } },
      ],
    };
  }
  return { id: { in: [] } };
}

export function assertSupplierRead(access: AccessContext, supplierId: string): void {
  if (access.isTenantWide) return;
  if (isPartnerUser(access)) {
    if (!access.allowedSupplierIds.includes(supplierId)) {
      throw new ForbiddenException('Supplier access denied');
    }
    return;
  }
  if (access.membershipRole === MembershipRole.client_user) {
    return;
  }
  throw new ForbiddenException('Supplier access denied');
}

export async function assertSupplierReadById(
  prisma: { supplier: { findFirst: (args: unknown) => Promise<{ id: string } | null> } },
  tenantSlug: string,
  supplierId: string,
  access: AccessContext,
): Promise<void> {
  if (access.isTenantWide) return;
  if (isPartnerUser(access)) {
    assertSupplierRead(access, supplierId);
    return;
  }
  if (access.membershipRole === MembershipRole.client_user) {
    const clientIds = access.allowedClientIds ?? [];
    if (clientIds.length === 0) throw new ForbiddenException('Supplier access denied');
    const hit = await prisma.supplier.findFirst({
      where: {
        id: supplierId,
        tenant: { slug: tenantSlug },
        OR: [
          { workOrders: { some: { vehicle: { clientId: { in: clientIds } } } } },
          { serviceCases: { some: { clientId: { in: clientIds } } } },
          { serviceAppointments: { some: { vehicle: { clientId: { in: clientIds } } } } },
        ],
      },
      select: { id: true },
    });
    if (!hit) throw new ForbiddenException('Supplier access denied');
    return;
  }
  throw new ForbiddenException('Supplier access denied');
}
