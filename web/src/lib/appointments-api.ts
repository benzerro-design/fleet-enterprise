export const appointmentsBrowserBase = "/api/appointments";

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

export type CalendarAppointment = {
  id: string;
  title: string;
  scheduledAt: string;
  endAt: string;
  durationMin: number;
  status: AppointmentStatus;
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
  supplierCategory: string | null;
  serviceCaseId: string;
  workflowType: string;
  sourceTicketId: string | null;
  ticketDisplayId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AppointmentStats = {
  today: number;
  thisWeek: number;
  confirmed: number;
  scheduled: number;
};

export const APPOINTMENT_STATUSES: { value: AppointmentStatus; label: string }[] = [
  { value: "scheduled", label: "Programat" },
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
