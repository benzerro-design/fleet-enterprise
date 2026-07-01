import { fleetJsonHeaders } from "@/lib/fleet-api";

export const workOrdersBrowserBase = "/api/work-orders";
export { fleetJsonHeaders };

export type WorkOrderStatus =
  | "draft"
  | "sent"
  | "in_progress"
  | "waiting_parts"
  | "done"
  | "cancelled";

export type WorkOrderListRow = {
  id: string;
  title: string;
  status: WorkOrderStatus;
  createdAt: string;
  updatedAt: string;
  plannedAt: string | null;
  completedAt: string | null;
  vehicleId: string;
  registrationNumber: string;
  clientId: string;
  clientCode: string;
  clientLegalName: string;
  supplierId: string | null;
  supplierCode: string | null;
  supplierLegalName: string | null;
  serviceCaseId: string;
  serviceCaseStage: string;
  workflowType: string;
  sourceTicketId: string | null;
  ticketDisplayId: string | null;
};

export type WorkOrderDetail = WorkOrderListRow & {
  notes: string | null;
  serviceCaseTitle: string;
  serviceCaseStatus: string;
};

export type WorkOrderListPayload = {
  items: WorkOrderListRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type WorkOrderStats = {
  open: number;
  inProgress: number;
  waitingParts: number;
  done: number;
};

export const WORK_ORDER_STATUSES: { value: WorkOrderStatus; label: string }[] = [
  { value: "draft", label: "Ciornă" },
  { value: "sent", label: "Trimisă" },
  { value: "in_progress", label: "În lucru" },
  { value: "waiting_parts", label: "Așteaptă piese" },
  { value: "done", label: "Finalizată" },
  { value: "cancelled", label: "Anulată" },
];

export function workOrderStatusLabel(status: WorkOrderStatus | string): string {
  return WORK_ORDER_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function serviceCaseStageLabel(stage: string): string {
  const map: Record<string, string> = {
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
