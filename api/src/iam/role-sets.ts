import { MembershipRole } from '@prisma/client';

/** Citire flotă — include useri client (date filtrate per ClientMembership). */
export const FLEET_READ_ROLES = [
  MembershipRole.tenant_admin,
  MembershipRole.tenant_viewer,
  MembershipRole.client_user,
] as const;

/** Scriere operațională flotă — tenant_admin + client_admin/dispatcher (scope în service). */
export const FLEET_WRITE_ROLES = [
  MembershipRole.tenant_admin,
  MembershipRole.client_user,
] as const;
