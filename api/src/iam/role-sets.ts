import { MembershipRole } from '@prisma/client';

/** Citire flotă — include useri client și furnizor (date filtrate per membership). */
export const FLEET_READ_ROLES = [
  MembershipRole.tenant_admin,
  MembershipRole.tenant_viewer,
  MembershipRole.client_user,
  MembershipRole.supplier_user,
] as const;

/** Scriere operațională flotă — tenant_admin + client/partner scoped în service. */
export const FLEET_WRITE_ROLES = [
  MembershipRole.tenant_admin,
  MembershipRole.client_user,
  MembershipRole.supplier_user,
] as const;
