import type { ClientRole, CrmTicketRoutingLevel, MembershipRole } from '@prisma/client';

export type ClientMembershipContext = {
  clientId: string;
  clientCode: string;
  role: ClientRole;
  driverId: string | null;
};

export type AccessContext = {
  userId: string;
  tenantId: string;
  tenantSlug: string;
  email: string;
  displayName: string;
  membershipRole: MembershipRole;
  /** tenant_admin sau tenant_viewer fără ClientMembership — vede tot tenant-ul. */
  isTenantWide: boolean;
  clientMemberships: ClientMembershipContext[];
  allowedClientIds: string[];
};

export type ActorContext = {
  userId: string;
  displayName: string;
  routingLevel: CrmTicketRoutingLevel;
};
