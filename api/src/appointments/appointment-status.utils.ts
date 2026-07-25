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

export const SERVICE_APPOINTMENT_STATUSES: ServiceAppointmentStatus[] = [
  ServiceAppointmentStatus.scheduled,
  ServiceAppointmentStatus.pending_supplier,
  ServiceAppointmentStatus.confirmed,
  ServiceAppointmentStatus.needs_repropose,
  ServiceAppointmentStatus.completed,
  ServiceAppointmentStatus.cancelled,
  ServiceAppointmentStatus.no_show,
];

export function parseServiceAppointmentStatus(
  raw?: string | null,
): ServiceAppointmentStatus | undefined {
  if (!raw?.trim()) return undefined;
  const v = raw.trim() as ServiceAppointmentStatus;
  if ((SERVICE_APPOINTMENT_STATUSES as string[]).includes(v)) return v;
  return undefined;
}

export type { ServiceAppointmentRecurrence, ServiceAppointmentStatus, ServiceAppointmentProposedBy };
