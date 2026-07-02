import { fleetJsonHeaders } from "@/lib/fleet-api";

export const serviceCasesBrowserBase = "/api/service-cases";
export { fleetJsonHeaders };

export type ServiceCaseStage =
  | "intake"
  | "scheduled"
  | "work_order"
  | "quote"
  | "approval"
  | "cost"
  | "invoiced"
  | "closed";

export type ServiceCaseWorkflowType =
  | "repair"
  | "damage"
  | "itp"
  | "tires"
  | "insurance_rca"
  | "insurance_casco";

export type WorkOrderRecord = {
  id: string;
  serviceCaseId: string;
  vehicleId: string;
  supplierId: string | null;
  supplierLegalName: string | null;
  title: string;
  status: string;
  plannedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type ServiceAppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

export type ServiceAppointmentRecord = {
  id: string;
  serviceCaseId: string;
  vehicleId: string;
  supplierId: string | null;
  supplierLegalName: string | null;
  title: string;
  scheduledAt: string;
  endAt: string;
  durationMin: number;
  location: string | null;
  status: ServiceAppointmentStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ServiceCaseRecord = {
  id: string;
  clientId: string;
  vehicleId: string | null;
  workflowType: ServiceCaseWorkflowType;
  sourceType: string;
  sourceTicketId: string | null;
  currentStage: ServiceCaseStage;
  status: string;
  supplierId: string | null;
  supplierLegalName: string | null;
  title: string;
  notes: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  workOrders: WorkOrderRecord[];
  appointments: ServiceAppointmentRecord[];
};

export const SERVICE_CASE_STAGES: ServiceCaseStage[] = [
  "intake",
  "scheduled",
  "work_order",
  "quote",
  "approval",
  "cost",
  "invoiced",
  "closed",
];

export function serviceCaseStageLabel(stage: ServiceCaseStage): string {
  const map: Record<ServiceCaseStage, string> = {
    intake: "Intake",
    scheduled: "Programare",
    work_order: "Comandă service",
    quote: "Deviz",
    approval: "Aprobare deviz",
    cost: "Cost",
    invoiced: "Facturat",
    closed: "Închis",
  };
  return map[stage] ?? stage;
}

export function appointmentStatusLabel(status: ServiceAppointmentStatus | string): string {
  const map: Record<string, string> = {
    scheduled: "Programat",
    confirmed: "Confirmat",
    completed: "Finalizat",
    cancelled: "Anulat",
    no_show: "Neprezentare",
  };
  return map[status] ?? status;
}
