import { MembershipRole } from '@prisma/client';

/** Citire flotă — include useri client (date filtrate per ClientMembership). */
export const FLEET_READ_ROLES = [
  MembershipRole.tenant_admin,
  MembershipRole.tenant_viewer,
  MembershipRole.client_user,
] as const;
