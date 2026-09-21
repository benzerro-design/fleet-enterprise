import {
  ServiceAppointmentProposedBy,
  ServiceAppointmentRecurrence,
  ServiceAppointmentStatus,
} from '@prisma/client';
import type { AccessContext } from '../iam/access-context.types';
import { MembershipRole } from '@prisma/client';

export type FleetCounterProposedBy = 'manager' | 'driver' | 'supplier' | 'admin';

export function parseFleetCounterProposedBy(raw: unknown): FleetCounterProposedBy | null {
  return raw === 'manager' || raw === 'driver' || raw === 'supplier' || raw === 'admin'
    ? raw
    : null;
}

export function proposedByFromAccess(access?: AccessContext): ServiceAppointmentProposedBy {
  if (!access) return ServiceAppointmentProposedBy.tenant_admin;
  if (access.membershipRole === MembershipRole.tenant_admin) {
    return ServiceAppointmentProposedBy.tenant_admin;
  }
  if (access.membershipRole === MembershipRole.supplier_user) {
    return ServiceAppointmentProposedBy.supplier;
  }
  return ServiceAppointmentProposedBy.client_manager;
}

/** Cine a propus slotul (contrapropunere / pending_supplier), pentru callout UI. */
export function fleetCounterFromAccess(
  access: AccessContext | undefined,
  opts?: { driverActor?: boolean },
): FleetCounterProposedBy {
  if (opts?.driverActor) return 'driver';
  if (!access) return 'admin';
  if (access.membershipRole === MembershipRole.tenant_admin) return 'admin';
  if (access.membershipRole === MembershipRole.supplier_user) return 'supplier';
  return 'manager';
}

export function fleetCounterFromProposedBy(
  role: ServiceAppointmentProposedBy | null | undefined,
): FleetCounterProposedBy | null {
  if (role === ServiceAppointmentProposedBy.tenant_admin) return 'admin';
  if (role === ServiceAppointmentProposedBy.client_manager) return 'manager';
  if (role === ServiceAppointmentProposedBy.supplier) return 'supplier';
  return null;
}

export function fleetCounterActorLabel(by: FleetCounterProposedBy): string {
  switch (by) {
    case 'driver':
      return 'Șoferul';
    case 'manager':
      return 'Managerul';
    case 'supplier':
      return 'Furnizorul';
    case 'admin':
      return 'Adminul L*';
  }
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

/**
 * true ⇒ refuză PATCH pe scheduledAt: trebuie /repropose sau /supplier-validate.
 * Permite setarea primului slot (existing null) și no-op pe același timp.
 */
export function blocksSilentScheduledAtEdit(opts: {
  status: ServiceAppointmentStatus;
  existingScheduledAt: Date | null | undefined;
  nextScheduledAt: Date;
}): boolean {
  if (!opts.existingScheduledAt) return false;
  if (opts.existingScheduledAt.getTime() === opts.nextScheduledAt.getTime()) return false;
  return (
    opts.status === ServiceAppointmentStatus.pending_supplier ||
    opts.status === ServiceAppointmentStatus.scheduled ||
    opts.status === ServiceAppointmentStatus.confirmed ||
    opts.status === ServiceAppointmentStatus.needs_repropose
  );
}

export const SILENT_SLOT_EDIT_BLOCKED_MESSAGE =
  'Schimbarea orei pe o programare activă trebuie făcută ca propunere (repropose / supplier-validate), nu prin editare directă.';

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
