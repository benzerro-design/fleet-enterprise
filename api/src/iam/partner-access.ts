import { ForbiddenException } from '@nestjs/common';
import { MembershipRole, SupplierRole } from '@prisma/client';
import type { AccessContext } from './access-context.types';

export function isPartnerUser(access: AccessContext): boolean {
  return access.membershipRole === MembershipRole.supplier_user;
}

export function allowedSupplierIds(access: AccessContext): string[] {
  return access.allowedSupplierIds ?? [];
}

export function assertPartnerSupplierId(access: AccessContext, supplierId: string | null | undefined): void {
  if (!isPartnerUser(access)) return;
  if (!supplierId?.trim()) {
    throw new ForbiddenException('Work order not assigned to a supplier');
  }
  if (!allowedSupplierIds(access).includes(supplierId.trim())) {
    throw new ForbiddenException('Supplier access denied');
  }
}

/** For list/calendar query params — partner may not request other suppliers. */
export function resolvePartnerSupplierIdFilter(
  access: AccessContext | undefined,
  requested?: string,
): string | undefined {
  if (!access || !isPartnerUser(access)) {
    return requested?.trim() || undefined;
  }
  const allowed = allowedSupplierIds(access);
  if (allowed.length === 0) {
    throw new ForbiddenException('No supplier membership');
  }
  if (requested?.trim()) {
    if (!allowed.includes(requested.trim())) {
      throw new ForbiddenException('Supplier access denied');
    }
    return requested.trim();
  }
  if (allowed.length === 1) return allowed[0];
  return undefined;
}

export function resolvePartnerSupplierIdsFilter(
  access: AccessContext | undefined,
  requested?: string[],
): string[] | undefined {
  if (!access || !isPartnerUser(access)) {
    return requested?.length ? requested : undefined;
  }
  const allowed = allowedSupplierIds(access);
  if (allowed.length === 0) {
    throw new ForbiddenException('No supplier membership');
  }
  if (requested?.length) {
    for (const id of requested) {
      if (!allowed.includes(id)) {
        throw new ForbiddenException('Supplier access denied');
      }
    }
    return requested;
  }
  return allowed;
}

export function canWritePartnerOps(access: AccessContext): boolean {
  if (!isPartnerUser(access)) return false;
  return access.supplierMemberships.some(
    (m) => m.role === SupplierRole.supplier_manager || m.role === SupplierRole.supplier_staff,
  );
}

export function assertPartnerWrite(access: AccessContext): void {
  if (isPartnerUser(access) && !canWritePartnerOps(access)) {
    throw new ForbiddenException('Read-only supplier role');
  }
}

/** Query ?supplierId= or ?suppliers=id1,id2 — used by admin view-as filters. */
export function parseSupplierIdsQuery(supplierId?: string, suppliers?: string): string[] | undefined {
  if (suppliers?.trim()) {
    const ids = suppliers
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return ids.length ? ids : undefined;
  }
  if (supplierId?.trim()) return [supplierId.trim()];
  return undefined;
}
