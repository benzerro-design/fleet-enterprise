import { ServiceAppointmentStatus, SupplierCategory } from '@prisma/client';

export type CalendarAppointmentRecord = {
  id: string;
  title: string;
  scheduledAt: string;
  endAt: string;
  durationMin: number;
  status: ServiceAppointmentStatus;
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
  scheduled: number;
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
