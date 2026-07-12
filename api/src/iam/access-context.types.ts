import type { ClientRole, CrmTicketRoutingLevel, MembershipRole, SupplierRole } from '@prisma/client';

export type ClientMembershipContext = {
  clientId: string;
  clientCode: string;
  role: ClientRole;
  driverId: string | null;
};

export type SupplierMembershipContext = {
  supplierId: string;
  supplierCode: string;
  supplierLegalName: string;
  role: SupplierRole;
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
  supplierMemberships: SupplierMembershipContext[];
  allowedSupplierIds: string[];
  /** Pentru rol driver — vehicule cu alocare activă (șofer ↔ vehicul). */
  assignedVehicleIds?: string[];
};

export type ActorContext = {
  userId: string;
  displayName: string;
  routingLevel: CrmTicketRoutingLevel;
};
