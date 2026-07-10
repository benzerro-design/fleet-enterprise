import {
  ServiceAppointmentProposedBy,
  ServiceAppointmentRecurrence,
  ServiceAppointmentStatus,
} from '@prisma/client';
import type { AccessContext } from '../iam/access-context.types';
import { MembershipRole } from '@prisma/client';

export function proposedByFromAccess(access?: AccessContext): ServiceAppointmentProposedBy {
  if (!access) return ServiceAppointmentProposedBy.tenant_admin;
  if (access.membershipRole === MembershipRole.tenant_admin) {
    return ServiceAppointmentProposedBy.tenant_admin;
  }
  return ServiceAppointmentProposedBy.client_manager;
}

/** Programare propusă de flotă/client → așteaptă validare furnizor dacă există supplier. */
export function resolveInitialAppointmentStatus(
  supplierId: string | null | undefined,
  createdBySupplier?: boolean,
): ServiceAppointmentStatus {
  if (createdBySupplier || !supplierId) {
    return ServiceAppointmentStatus.scheduled;
  }
  return ServiceAppointmentStatus.pending_supplier;
}

export function appointmentStatusAllowsManagerConfirm(status: ServiceAppointmentStatus): boolean {
  return (
    status === ServiceAppointmentStatus.scheduled || status === ServiceAppointmentStatus.confirmed
  );
}

export type { ServiceAppointmentRecurrence, ServiceAppointmentStatus, ServiceAppointmentProposedBy };
