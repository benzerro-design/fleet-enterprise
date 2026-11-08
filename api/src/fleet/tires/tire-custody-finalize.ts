import { TireCustodySignerRole } from '@prisma/client';

/** Bilateral acceptance: partner + (customer | driver). Witness alone is never enough. */
export function assertTireCustodyFinalizeRoles(
  roles: Iterable<TireCustodySignerRole | string>,
): { ok: true } | { ok: false; message: string } {
  const set = new Set(roles);
  if (set.size < 2) {
    return {
      ok: false,
      message: 'Need at least 2 signatures (partner + customer/driver)',
    };
  }
  if (!set.has(TireCustodySignerRole.partner) && !set.has('partner')) {
    return { ok: false, message: 'Partner signature required' };
  }
  const hasCustomer =
    set.has(TireCustodySignerRole.customer) || set.has('customer');
  const hasDriver = set.has(TireCustodySignerRole.driver) || set.has('driver');
  if (!hasCustomer && !hasDriver) {
    return { ok: false, message: 'Customer or driver signature required' };
  }
  return { ok: true };
}
