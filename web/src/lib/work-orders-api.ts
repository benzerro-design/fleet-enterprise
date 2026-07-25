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

export type ServiceOrderType = "M" | "E" | "D" | "TV";

export type WorkOrderVehicleSnapshot = {
  registrationNumber: string;
  brand: string | null;
  model: string | null;
  vin: string | null;
  odometerKm: number;
  itpExpiresOn: string | null;
};

export type WorkOrderClientSnapshot = {
  legalName: string;
  taxId: string | null;
  addressLine: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  billingNotes: string | null;
};

export type WorkOrderSupplierSnapshot = {
  legalName: string;
  taxId: string | null;
  addressLine: string | null;
  city: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
};

export type WorkOrderListRow = {
  id: string;
  title: string;
  displayNumber: string | null;
  status: WorkOrderStatus;
  serviceOrderType: ServiceOrderType;
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
  serviceCaseStatus: string;
  workflowType: string;
  sourceTicketId: string | null;
  ticketDisplayId: string | null;
  ticketSubject: string | null;
  readyAt: string | null;
  estimatedRepairAt: string | null;
  quoteSummary: WorkOrderQuoteSummary;
};

export type WorkOrderQuoteSummary = {
  status: string | null;
  version: number | null;
  totalGrossCents: number | null;
  currency: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  invoicedAt: string | null;
};

export type WorkOrderInbox = "open" | "pending_approval" | "in_service" | "ready" | "invoiced";

export type WorkOrderTicketSettlement = {
  entityType: "maintenance" | "cost" | "document";
  entityId: string;
  createdAt: string;
};

export type WorkOrderDetail = WorkOrderListRow & {
  notes: string | null;
  serviceCaseTitle: string;
  linkedAppointmentId: string | null;
  linkedAppointmentScheduledAt: string | null;
  awaitingPostApproval: boolean;
  postApprovalPath: "immediate" | "reschedule" | null;
  inServiceAt: string | null;
  outServiceAt: string | null;
  visit2InServiceAt: string | null;
  visit2OutServiceAt: string | null;
  odometerKmIn: number | null;
  odometerKmOut: number | null;
  visit2OdometerKmIn: number | null;
  visit2OdometerKmOut: number | null;
  repairPathNote: string | null;
  ticketSettlement: WorkOrderTicketSettlement | null;
  hasQuoteCost: boolean;
  vehicle: WorkOrderVehicleSnapshot;
  client: WorkOrderClientSnapshot;
  supplier: WorkOrderSupplierSnapshot | null;
  ticketSubject: string | null;
  driverName: string | null;
  driverPhone: string | null;
  vehicleMovable?: "movable" | "immovable" | null;
  damagePayerType?: "insurer" | "client" | null;
  damageInsurerPipelineStatus?:
    | "docs_pending"
    | "ready_to_notify"
    | "notified"
    | "inspection_note"
    | "reinspection_requested"
    | "quote_ready"
    | "payment_accepted"
    | null;
  damageInsuranceType?: "RCA" | "CASCO" | "BOTH" | "UNKNOWN" | null;
  damageClaimNumber?: string | null;
  damageInsurerName?: string | null;
  damageClaimStatus?: string | null;
  damageInsurerAgreedAt?: string | null;
  damageDocuments?: {
    id: string;
    kind: string;
    label?: string;
    notes?: string;
    received: boolean;
    uploadedAt: string;
    uploadedByLabel?: string;
  }[];
  damagePhotos?: {
    id: string;
    url: string;
    kind: "exterior" | "damage_detail" | "odometer" | "other";
    caption?: string;
    uploadedAt: string;
    uploadedByUserId?: string;
    uploadedByLabel?: string;
  }[];
  damageSectionLocks?: Partial<
    Record<
      "claim_info" | "documents" | "photos" | "pipeline",
      { lockedByUserId: string; lockedByLabel?: string; lockedAt: string }
    >
  >;
  damageCascoFranchiseCents?: number | null;
  damageInsurerEmail?: string | null;
  damageQuoteOrigin?: "prepared_by_us" | "received_from_insurer" | null;
  damageInsurerQuotePdfUrl?: string | null;
  damageInsurerMailLog?: {
    id: string;
    at: string;
    direction: "outbound" | "inbound_note";
    to: string;
    subject: string;
    status: "sent" | "stubbed" | "failed";
    quoteId?: string;
    note?: string;
    pdfUrl?: string;
    error?: string;
  }[];
};

export type ServiceTimesResult = WorkOrderDetail & {
  fleetOdometerUpdate?: {
    updated: boolean;
    previousKm: number;
    newKm: number | null;
  };
};

export type QuoteLineType = "labor" | "parts" | "other";
export type QuoteLineApprovalStatus = "pending" | "approved" | "rejected";
export type QuotePartsOrderStatus = "none" | "ordered" | "in_stock" | "delivered";

export type QuoteLineRecord = {
  id: string;
  sortOrder: number;
  lineType: QuoteLineType;
  description: string;
  quantity: number;
  unitNetCents: number;
  vatRatePercent: number;
  partNumber: string | null;
  partCodeExempt: boolean;
  approvalStatus: QuoteLineApprovalStatus;
  partsOrderStatus: QuotePartsOrderStatus;
  partsExpectedOn: string | null;
  warrantyMonths: number | null;
  warrantyKm: number | null;
  lineNetCents: number;
  lineVatCents: number;
};

export type WorkOrderQuoteStatus = "draft" | "submitted" | "approved" | "rejected";

export type WorkOrderQuoteRecord = {
  id: string;
  workOrderId: string;
  version: number;
  status: WorkOrderQuoteStatus;
  currency: string;
  totalNetCents: number;
  totalVatCents: number;
  totalGrossCents: number;
  approvedNetCents: number | null;
  approvedVatCents: number | null;
  approvedGrossCents: number | null;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  notes: string | null;
  costEntryId: string | null;
  invoicedAt: string | null;
  costInvoiceNumber: string | null;
  costInvoiceDate: string | null;
  invoiceAttachmentUrl: string | null;
  createdAt: string;
  updatedAt: string;
  lines: QuoteLineRecord[];
};

export type QuoteLineInput = {
  lineType?: QuoteLineType;
  description: string;
  quantity?: number;
  unitNetCents: number;
  vatRatePercent?: number;
  partNumber?: string | null;
  partCodeExempt?: boolean;
  approvalStatus?: QuoteLineApprovalStatus;
  partsOrderStatus?: QuotePartsOrderStatus;
  partsExpectedOn?: string | null;
  warrantyMonths?: number | null;
  warrantyKm?: number | null;
  sortOrder?: number;
};

export function formatMoneyCents(cents: number, currency = "RON"): string {
  return `${(cents / 100).toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export function quoteStatusLabel(status: WorkOrderQuoteStatus | string): string {
  const map: Record<string, string> = {
    draft: "Ciornă",
    submitted: "Trimis spre aprobare",
    approved: "Aprobat",
    rejected: "Respins",
  };
  return map[status] ?? status;
}

export function quoteLineTypeLabel(type: QuoteLineType | string): string {
  const map: Record<string, string> = {
    labor: "Manoperă",
    parts: "Piese",
    other: "Altele",
  };
  return map[type] ?? type;
}

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
  pendingApproval: number;
  readyUninvoiced: number;
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
