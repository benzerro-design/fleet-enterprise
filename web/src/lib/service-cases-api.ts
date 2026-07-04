import { fleetJsonHeaders } from "@/lib/fleet-api";

export const serviceCasesBrowserBase = "/api/service-cases";
export { fleetJsonHeaders };

export type ServiceCaseStage =
  | "intake"
  | "scheduled"
  | "work_order"
  | "in_service"
  | "out_service"
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

export type PostApprovalPath = "immediate" | "reschedule";

export type WorkOrderQuoteStatus = "draft" | "submitted" | "approved" | "rejected";

export type QuoteSummary = {
  id: string;
  workOrderId: string;
  version: number;
  status: WorkOrderQuoteStatus;
  totalGrossCents: number;
  currency: string;
  invoicedAt: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  costEntryId: string | null;
};

export type WorkOrderRecord = {
  id: string;
  serviceCaseId: string;
  vehicleId: string;
  supplierId: string | null;
  supplierLegalName: string | null;
  title: string;
  status: string;
  displayNumber: string | null;
  odometerKmIn: number | null;
  odometerKmOut: number | null;
  repairPathNote: string | null;
  plannedAt: string | null;
  completedAt: string | null;
  inServiceAt: string | null;
  outServiceAt: string | null;
  createdAt: string;
  latestQuote: QuoteSummary | null;
  approvedQuote?: QuoteSummary | null;
  pendingQuote?: QuoteSummary | null;
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
  managerConfirmedAt: string | null;
  driverAcknowledgedAt: string | null;
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
  awaitingPostApproval: boolean;
  postApprovalPath: PostApprovalPath | null;
  createdAt: string;
  updatedAt: string;
  workOrders: WorkOrderRecord[];
  appointments: ServiceAppointmentRecord[];
};

export const SERVICE_CASE_STAGES: ServiceCaseStage[] = [
  "intake",
  "scheduled",
  "work_order",
  "in_service",
  "out_service",
  "quote",
  "approval",
  "invoiced",
  "cost",
  "closed",
];

export function serviceCaseStageLabel(stage: ServiceCaseStage): string {
  const map: Record<ServiceCaseStage, string> = {
    intake: "Intake",
    scheduled: "Programare",
    work_order: "Comandă service",
    in_service: "In service",
    out_service: "Out service",
    quote: "Deviz",
    approval: "Aprobare deviz",
    invoiced: "Facturat",
    cost: "Cost",
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

export function quoteStatusLabel(status: WorkOrderQuoteStatus | string): string {
  const map: Record<string, string> = {
    draft: "Ciornă",
    submitted: "Trimis",
    approved: "Aprobat",
    rejected: "Respins",
  };
  return map[status] ?? status;
}

export function formatQuoteMoney(cents: number, currency = "RON"): string {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}
