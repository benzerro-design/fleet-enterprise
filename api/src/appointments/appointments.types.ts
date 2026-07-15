import { ServiceAppointmentRecurrence, ServiceAppointmentStatus, ServiceAppointmentProposedBy, SupplierCategory } from '@prisma/client';

export type CalendarWorkOrderSummary = {
  id: string;
  title: string;
  status: string;
};

export type CalendarAppointmentRecord = {
  id: string;
  title: string;
  scheduledAt: string;
  endAt: string;
  durationMin: number;
  status: ServiceAppointmentStatus;
  proposedByRole: ServiceAppointmentProposedBy | null;
  supplierValidatedAt: string | null;
  cancellationRequestedAt: string | null;
  cancellationRequestNote: string | null;
  location: string | null;
  notes: string | null;
  vehicleId: string;
  registrationNumber: string;
  clientId: string;
  clientCode: string;
  clientLegalName: string;
  supplierId: string | null;
  supplierCode: string | null;
  supplierLegalName: string | null;
  supplierCategory: SupplierCategory | null;
  serviceCaseId: string;
  workflowType: string;
  sourceTicketId: string | null;
  ticketDisplayId: string | null;
  workOrders: CalendarWorkOrderSummary[];
  recurrenceRule: ServiceAppointmentRecurrence;
  recurrenceSeriesId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CalendarListParams = {
  from: string;
  to: string;
  supplierIds?: string[];
  vehicleId?: string;
  clientId?: string;
  status?: ServiceAppointmentStatus;
};

export type AppointmentStats = {
  today: number;
  thisWeek: number;
  confirmed: number;
  /** @deprecated use awaitingConfirm */
  scheduled: number;
  pendingSupplier: number;
  awaitingConfirm: number;
};

export type CreateCalendarAppointmentInput = {
  vehicleId: string;
  scheduledAt: string;
  durationMin?: number;
  title?: string;
  supplierId?: string | null;
  location?: string | null;
  notes?: string | null;
  serviceCaseId?: string;
  sourceTicketId?: string;
  recurrenceRule?: ServiceAppointmentRecurrence;
  /** Dacă true, programare directă de furnizor (fără pending_supplier). */
  createdBySupplier?: boolean;
};

export type UpdateCalendarAppointmentInput = {
  scheduledAt?: string;
  durationMin?: number;
  title?: string;
  supplierId?: string | null;
  location?: string | null;
  notes?: string | null;
  status?: ServiceAppointmentStatus;
};

export function ticketDisplayId(ticketId: string | null | undefined): string | null {
  if (!ticketId) return null;
  return ticketId.slice(-6).toUpperCase();
}

export function endAtIso(scheduledAt: Date, durationMin: number): string {
  return new Date(scheduledAt.getTime() + durationMin * 60_000).toISOString();
}

const RECURRENCE_OCCURRENCES = 8;

export function recurrenceOccurrenceDates(
  base: Date,
  rule: ServiceAppointmentRecurrence,
): Date[] {
  if (rule === ServiceAppointmentRecurrence.none) return [base];
  return Array.from({ length: RECURRENCE_OCCURRENCES }, (_, i) => {
    const d = new Date(base);
    if (rule === ServiceAppointmentRecurrence.weekly) {
      d.setDate(d.getDate() + i * 7);
    } else if (rule === ServiceAppointmentRecurrence.biweekly) {
      d.setDate(d.getDate() + i * 14);
    } else {
      d.setMonth(d.getMonth() + i);
    }
    return d;
  });
}
