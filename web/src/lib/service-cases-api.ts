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

export type DamageInsuranceType = "RCA" | "CASCO" | "BOTH" | "UNKNOWN";

export type VehicleMovableState = "movable" | "immovable";
export type DamagePayerType = "insurer" | "client";

export type DamageInsurerPipelineStatus =
  | "docs_pending"
  | "ready_to_notify"
  | "notified"
  | "inspection_note"
  | "reinspection_requested"
  | "quote_ready"
  | "payment_accepted";

export type DamageQuoteOrigin = "prepared_by_us" | "received_from_insurer";

export type DamageInsurerMailLogItem = {
  id: string;
  at: string;
  direction: "outbound" | "inbound_note";
  to: string;
  subject: string;
  status: "sent" | "stubbed" | "failed";
  /** quote = deviz; avizare; reinspection. Lipsă → treat as quote (legacy). */
  kind?: "quote" | "avizare" | "reinspection";
  quoteId?: string;
  note?: string;
  pdfUrl?: string;
  attachmentUrls?: string[];
  error?: string;
};

export type DamageInspectionMode = "photos" | "on_site";

export type DamageClaimStatus =
  | "open"
  | "documents_pending"
  | "insurer_review"
  | "agreed"
  | "rejected"
  | "closed";

export type DamageDocumentKind =
  | "declaration"
  | "police_report"
  | "amicable_settlement"
  | "id_card"
  | "driving_license"
  | "casco_policy"
  | "rca_policy"
  | "itp_expiry"
  | "registration_certificate"
  | "power_of_attorney"
  | "person1_id_license"
  | "vehicle1_cert_rca"
  | "person2_id_license"
  | "vehicle2_cert_rca"
  | "other";

/** Checklist daună → tip document din modulul Documente flotă. */
export const DAMAGE_KIND_TO_FLEET_DOC: Partial<Record<DamageDocumentKind, string>> = {
  casco_policy: "casco",
  rca_policy: "rca",
  itp_expiry: "itp_cert",
  registration_certificate: "cert_inmatriculare",
};

export type DamagePhotoKind = "exterior" | "damage_detail" | "odometer" | "repaired" | "other";

export type DamageReinspectionRequestStatus = "pending" | "approved" | "rejected";

/** Notă constatare sau PVS. */
export type DamageInspectionNoteItem = {
  id: string;
  kind?: "inspection_note" | "pvs";
  sequence?: number;
  requestId?: string;
  pdfUrl: string;
  fileName?: string;
  mode?: DamageInspectionMode | null;
  issuedOn?: string | null;
  receivedAt: string;
  notes?: string | null;
};

export type DamageReinspectionRequestItem = {
  id: string;
  kind: "reinspection_request";
  sequence: number;
  status: DamageReinspectionRequestStatus;
  explanation: string;
  photoIds: string[];
  sentAt: string;
  decidedAt?: string;
  rejectionReason?: string;
  linkedPvsId?: string;
  mailLogId?: string;
};

export type DamageConstatareHistoryItem =
  | DamageInspectionNoteItem
  | DamageReinspectionRequestItem;

export function isReinspectionRequest(
  item: DamageConstatareHistoryItem,
): item is DamageReinspectionRequestItem {
  return item.kind === "reinspection_request";
}

export function isInspectionPdfDoc(
  item: DamageConstatareHistoryItem,
): item is DamageInspectionNoteItem {
  return item.kind !== "reinspection_request";
}

export type DamageSectionKey = "claim_info" | "documents" | "photos" | "pipeline";

export type DamageDocumentItem = {
  id: string;
  kind: string;
  label?: string;
  notes?: string;
  received: boolean;
  uploadedAt: string;
  uploadedByLabel?: string;
  url?: string;
  fileName?: string;
  /** YYYY-MM-DD — ex. data expirare ITP (poate exista fără fișier). */
  expiresOn?: string;
};

export type DamagePhotoItem = {
  id: string;
  url: string;
  kind: DamagePhotoKind;
  caption?: string;
  uploadedAt: string;
  uploadedByUserId?: string;
  uploadedByLabel?: string;
};

export type DamageSectionLock = {
  lockedByUserId: string;
  lockedByLabel?: string;
  lockedAt: string;
};

export type DamageSectionLocks = Partial<Record<DamageSectionKey, DamageSectionLock>>;

export type PatchDamageClaimInput = {
  vehicleMovable?: VehicleMovableState | null;
  damageInsuranceType?: DamageInsuranceType | null;
  damageClaimNumber?: string | null;
  damageInsurerName?: string | null;
  damageInsurerId?: string | null;
  damageClaimStatus?: DamageClaimStatus | null;
  damagePayerType?: DamagePayerType | null;
  damageInsurerPipelineStatus?: DamageInsurerPipelineStatus | null;
  damageDocuments?: DamageDocumentItem[] | null;
  damagePhotos?: DamagePhotoItem[] | null;
  agreeInsurer?: boolean;
  clientPayerConfirmed?: boolean;
  damageInsurerAgreementNotes?: string | null;
  damageCascoFranchiseCents?: number | null;
  damageInsurerEmail?: string | null;
  damageQuoteOrigin?: DamageQuoteOrigin | null;
  damageInsurerQuotePdfUrl?: string | null;
  damageInspectionMode?: DamageInspectionMode | null;
  damageInspectionNotePdfUrl?: string | null;
  damageInspectionNoteFileName?: string | null;
  /** YYYY-MM-DD */
  damageInspectionNoteIssuedOn?: string | null;
  damageInspectionNoteNotes?: string | null;
  damageInspectionDocKind?: "inspection_note" | "pvs" | null;
  damagePvsLinkedRequestId?: string | null;
  damagePaymentAcceptancePdfUrl?: string | null;
  damagePaymentAcceptanceFileName?: string | null;
  damagePaymentAcceptanceNotes?: string | null;
  lockSection?: { section: DamageSectionKey | string; lock: boolean };
};

export type PostApprovalPath = "immediate" | "reschedule";

/** Checklist generic (legacy / tip necunoscut). */
export const DAMAGE_DOCUMENT_KINDS: { kind: DamageDocumentKind; label: string }[] = [
  { kind: "declaration", label: "Declarație eveniment" },
  { kind: "police_report", label: "Proces-verbal poliție" },
  { kind: "amicable_settlement", label: "Constatare amiabilă" },
  { kind: "id_card", label: "CI" },
  { kind: "driving_license", label: "Permis de conducere" },
  { kind: "other", label: "Altele" },
];

export const DAMAGE_DOCS_CASCO: { kind: DamageDocumentKind; label: string }[] = [
  { kind: "declaration", label: "Declarație eveniment" },
  { kind: "id_card", label: "CI persoană implicată" },
  { kind: "driving_license", label: "Permis persoană implicată" },
  { kind: "casco_policy", label: "Poliță CASCO mașină" },
  { kind: "rca_policy", label: "Poliță RCA mașină" },
  { kind: "itp_expiry", label: "Data expirare ITP" },
  { kind: "registration_certificate", label: "Certificat înmatriculare" },
  { kind: "power_of_attorney", label: "Împuternicire" },
];

export const DAMAGE_DOCS_RCA: { kind: DamageDocumentKind; label: string }[] = [
  { kind: "person1_id_license", label: "CI + permis — persoană 1" },
  { kind: "vehicle1_cert_rca", label: "Certificat + RCA — mașină 1" },
  { kind: "person2_id_license", label: "CI + permis — persoană 2" },
  { kind: "vehicle2_cert_rca", label: "Certificat + RCA — mașină 2" },
  { kind: "amicable_settlement", label: "Formular constatare amiabilă" },
];

export const DAMAGE_PIPELINE_STATUSES: {
  value: DamageInsurerPipelineStatus;
  label: string;
}[] = [
  { value: "docs_pending", label: "1. Documente" },
  { value: "ready_to_notify", label: "2. Pregătit avizare" },
  { value: "notified", label: "3. Avizat" },
  { value: "inspection_note", label: "4. Notă constatare" },
  { value: "reinspection_requested", label: "4b. Reconstatare" },
  { value: "quote_ready", label: "5. Deviz gata" },
  { value: "payment_accepted", label: "6. Accept plată" },
];

export const DAMAGE_PHOTO_KINDS: { kind: DamagePhotoKind; label: string }[] = [
  { kind: "exterior", label: "Exterior" },
  { kind: "damage_detail", label: "Detaliu avarie" },
  { kind: "odometer", label: "Odometru" },
  { kind: "repaired", label: "Auto reparat" },
  { kind: "other", label: "Altele" },
];

/** Tipuri pentru galeria inițială (înainte de reparație). */
export const DAMAGE_PHOTO_KINDS_INITIAL: { kind: DamagePhotoKind; label: string }[] = [
  { kind: "exterior", label: "Exterior" },
  { kind: "damage_detail", label: "Detaliu avarie" },
  { kind: "odometer", label: "Odometru" },
  { kind: "other", label: "Altele" },
];

export function documentKindsForInsurance(
  insuranceType: DamageInsuranceType | "" | null | undefined,
): { kind: DamageDocumentKind; label: string }[] {
  if (insuranceType === "CASCO") return DAMAGE_DOCS_CASCO;
  if (insuranceType === "RCA") return DAMAGE_DOCS_RCA;
  if (insuranceType === "BOTH") {
    const seen = new Set<string>();
    const out: { kind: DamageDocumentKind; label: string }[] = [];
    for (const d of [...DAMAGE_DOCS_CASCO, ...DAMAGE_DOCS_RCA]) {
      if (seen.has(d.kind)) continue;
      seen.add(d.kind);
      out.push(d);
    }
    return out;
  }
  return DAMAGE_DOCUMENT_KINDS;
}

export function mergeDamageDocuments(
  template: { kind: DamageDocumentKind; label: string }[],
  existing: DamageDocumentItem[] | undefined,
): DamageDocumentItem[] {
  const byKind = new Map((existing ?? []).map((d) => [d.kind, d]));
  const fromTemplate = template.map((d) => {
    const prev = byKind.get(d.kind);
    if (prev) return { ...prev, label: prev.label ?? d.label };
    return {
      id: d.kind,
      kind: d.kind,
      label: d.label,
      received: false,
      uploadedAt: new Date().toISOString(),
    };
  });
  const templateKinds = new Set(template.map((t) => t.kind));
  const extras = (existing ?? []).filter((d) => !templateKinds.has(d.kind as DamageDocumentKind));
  return [...fromTemplate, ...extras];
}

export function damageClaimStatusLabel(status: DamageClaimStatus | string | null | undefined): string {
  if (!status) return "—";
  const map: Record<string, string> = {
    open: "Deschis",
    documents_pending: "Documente lipsă",
    insurer_review: "La asigurător",
    agreed: "Acordat",
    rejected: "Respins",
    closed: "Închis",
  };
  return map[status] ?? status;
}

export function damagePipelineStatusLabel(
  status: DamageInsurerPipelineStatus | string | null | undefined,
): string {
  if (!status) return "—";
  return DAMAGE_PIPELINE_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function vehicleMovableLabel(state: VehicleMovableState | string | null | undefined): string {
  if (state === "movable") return "Deplasabilă";
  if (state === "immovable") return "Nedeplasabilă";
  return "—";
}

export function damagePayerLabel(payer: DamagePayerType | string | null | undefined): string {
  if (payer === "insurer") return "Asigurător";
  if (payer === "client") return "Client";
  return "—";
}

export function isDamageInsurerReady(sc: {
  damagePayerType?: DamagePayerType | null;
  damageInsurerPipelineStatus?: DamageInsurerPipelineStatus | null;
  damageInsurerAgreedAt?: string | null;
}): boolean {
  if (sc.damagePayerType === "client") return !!sc.damageInsurerAgreedAt;
  return (
    sc.damageInsurerPipelineStatus === "payment_accepted" || !!sc.damageInsurerAgreedAt
  );
}

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
  invoiceAttachmentUrl: string | null;
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
  serviceOrderType?: string;
  readyAt?: string | null;
  estimatedRepairAt?: string | null;
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
  | "pending_supplier"
  | "needs_repropose"
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
  proposedByRole: string | null;
  supplierValidatedAt: string | null;
  cancellationRequestedAt?: string | null;
  cancellationRequestNote?: string | null;
  notes: string | null;
  managerConfirmedAt: string | null;
  driverAcknowledgedAt: string | null;
  driverDeclinedAt?: string | null;
  driverDeclineNote?: string | null;
  lastProposalNote?: string | null;
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
  vehicleMovable?: VehicleMovableState | null;
  damageInsuranceType?: DamageInsuranceType | null;
  damageClaimNumber?: string | null;
  damageInsurerName?: string | null;
  damageInsurerId?: string | null;
  damageClaimStatus?: DamageClaimStatus | null;
  damageInsurerAgreedAt?: string | null;
  damageInsurerAgreedByUserId?: string | null;
  damageInsurerAgreementNotes?: string | null;
  damagePayerType?: DamagePayerType | null;
  damageInsurerPipelineStatus?: DamageInsurerPipelineStatus | null;
  damageDocuments?: DamageDocumentItem[];
  damagePhotos?: DamagePhotoItem[];
  damageSectionLocks?: DamageSectionLocks;
  /** Franciză CASCO în cenți RON — plătită de client. */
  damageCascoFranchiseCents?: number | null;
  damageInsurerEmail?: string | null;
  damageQuoteOrigin?: DamageQuoteOrigin | null;
  damageInsurerQuotePdfUrl?: string | null;
  damageInsurerMailLog?: DamageInsurerMailLogItem[];
  damageInspectionMode?: DamageInspectionMode | null;
  damageInspectionNotePdfUrl?: string | null;
  damageInspectionNoteFileName?: string | null;
  damageInspectionNoteIssuedOn?: string | null;
  damageInspectionNoteReceivedAt?: string | null;
  damageInspectionNoteNotes?: string | null;
  damageInspectionNotes?: DamageConstatareHistoryItem[];
  damagePaymentAcceptancePdfUrl?: string | null;
  damagePaymentAcceptanceFileName?: string | null;
  damagePaymentAcceptanceReceivedAt?: string | null;
  damagePaymentAcceptanceNotes?: string | null;
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
    pending_supplier: "Așteaptă validare furnizor",
    needs_repropose: "Șofer nu poate — reprogramare",
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
