export const appointmentsBrowserBase = "/api/appointments";

export type AppointmentStatus =
  | "scheduled"
  | "pending_supplier"
  | "needs_repropose"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

export type AppointmentRecurrence = "none" | "weekly" | "biweekly" | "monthly";

export type CalendarWorkOrderSummary = {
  id: string;
  title: string;
  status: string;
  displayNumber: string | null;
  inServiceAt: string | null;
  outServiceAt: string | null;
};

export type CalendarAppointment = {
  id: string;
  title: string;
  scheduledAt: string | null;
  endAt: string | null;
  durationMin: number;
  status: AppointmentStatus;
  location: string | null;
  notes: string | null;
  vehicleId: string;
  registrationNumber: string;
  vehicleBrand: string | null;
  vehicleModel: string | null;
  vehicleVin: string | null;
  clientId: string;
  clientCode: string;
  clientLegalName: string;
  supplierId: string | null;
  supplierCode: string | null;
  supplierLegalName: string | null;
  supplierCategory: string | null;
  serviceCaseId: string;
  workflowType: string;
  sourceTicketId: string | null;
  ticketDisplayId: string | null;
  workOrders: CalendarWorkOrderSummary[];
  recurrenceRule: AppointmentRecurrence;
  recurrenceSeriesId: string | null;
  proposedByRole: string | null;
  supplierValidatedAt: string | null;
  cancellationRequestedAt: string | null;
  cancellationRequestNote: string | null;
  managerConfirmedAt: string | null;
  driverAcknowledgedAt: string | null;
  driverDeclinedAt: string | null;
  driverDeclineNote: string | null;
  lastProposalNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AppointmentStats = {
  today: number;
  thisWeek: number;
  confirmed: number;
  /** @deprecated use awaitingConfirm */
  scheduled: number;
  pendingSupplier: number;
  awaitingConfirm: number;
  needsRepropose: number;
};

export const APPOINTMENT_STATUSES: { value: AppointmentStatus; label: string }[] = [
  { value: "scheduled", label: "Programat" },
  { value: "pending_supplier", label: "Așteaptă furnizor" },
  { value: "needs_repropose", label: "Șofer nu poate — reprogramare" },
  { value: "confirmed", label: "Confirmat" },
  { value: "completed", label: "Finalizat" },
  { value: "cancelled", label: "Anulat" },
  { value: "no_show", label: "Neprezentare" },
];

export function appointmentStatusLabel(status: AppointmentStatus | string): string {
  return APPOINTMENT_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function workflowTypeLabel(type: string): string {
  const map: Record<string, string> = {
    repair: "Reparație",
    damage: "Daună",
    itp: "ITP",
    tires: "Anvelope",
    insurance_rca: "RCA",
    insurance_casco: "CASCO",
  };
  return map[type] ?? type;
}

export const APPOINTMENT_RECURRENCE: { value: AppointmentRecurrence; label: string }[] = [
  { value: "none", label: "Fără recurență" },
  { value: "weekly", label: "Săptămânal" },
  { value: "biweekly", label: "La 2 săptămâni" },
  { value: "monthly", label: "Lunar" },
];

export function recurrenceLabel(rule: AppointmentRecurrence | string): string {
  return APPOINTMENT_RECURRENCE.find((r) => r.value === rule)?.label ?? rule;
}

export type SlottedCalendarAppointment = CalendarAppointment & { scheduledAt: string };

export function appointmentHasSlot(
  scheduledAt: string | null | undefined,
): scheduledAt is string {
  return Boolean(scheduledAt && !Number.isNaN(new Date(scheduledAt).getTime()));
}

export function formatAppointmentSlot(
  scheduledAt: string | null | undefined,
  opts?: { partner?: boolean },
): string {
  if (!appointmentHasSlot(scheduledAt)) {
    return opts?.partner
      ? "Fără dată — clientul a solicitat slot"
      : "Fără dată — furnizorul propune";
  }
  return new Date(scheduledAt).toLocaleString("ro-RO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
