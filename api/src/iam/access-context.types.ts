import type { ClientRole, CrmTicketRoutingLevel, FunctionalProfile, MembershipRole, SupplierRole } from '@prisma/client';

export type ClientMembershipContext = {
  clientId: string;
  clientCode: string;
  role: ClientRole;
  driverId: string | null;
  /** IAM-003 — null = legacy (fără F/T/G). */
  functionalProfile: FunctionalProfile | null;
  iamSettings: {
    allowClientOcr: boolean;
    allowClientAcquisition: boolean;
    requireDriverAck: boolean;
    driverCanNegotiateAppointment: boolean;
    appointmentProposeFleetFirst: boolean;
    ticketListBulkSelect: boolean;
    appointmentProposalHistoryTabs: boolean;
    allowClientAdminCreateUsers: boolean;
  };
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
  /** IAM-003 pe L* TenantMembership. */
  tenantFunctionalProfile: FunctionalProfile | null;
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
