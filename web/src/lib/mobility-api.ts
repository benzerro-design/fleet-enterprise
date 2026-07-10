import { fleetJsonHeaders } from "@/lib/fleet-api";

export const mobilityBrowserBase = "/api/mobility";
export { fleetJsonHeaders };

export const MOBILITY_ELIGIBILITY_HOURS = 72;

export type MobilityAssignmentStatus =
  | "draft"
  | "eligible"
  | "reserved"
  | "active"
  | "returned"
  | "waived"
  | "cancelled";

export type MobilityDeliveryMode = "customer_pickup" | "delivered_to_customer" | "at_supplier";

export const MOBILITY_DELIVERY_MODES: MobilityDeliveryMode[] = [
  "customer_pickup",
  "delivered_to_customer",
  "at_supplier",
];

export type MobilityAssignmentRecord = {
  id: string;
  displayNumber: string | null;
  workOrderId: string;
  workOrderDisplayNumber: string | null;
  serviceCaseId: string;
  sourceTicketId: string | null;
  clientId: string;
  clientLegalName: string;
  coveredVehicleId: string;
  coveredVehicleReg: string | null;
  supplierId: string | null;
  supplierLegalName: string | null;
  replacementRegistration: string | null;
  status: MobilityAssignmentStatus;
  eligibilityHours: number | null;
  eligibilityTriggeredAt: string | null;
  handoverAt: string | null;
  expectedReturnAt: string | null;
  returnedAt: string | null;
  deliveryMode: MobilityDeliveryMode | null;
  handoverUserLabel: string | null;
  waivedReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MobilityEligibilityRecord = {
  workOrderId: string;
  eligible: boolean;
  immobilizationHours: number | null;
  thresholdHours: number;
  inServiceAt: string | null;
  estimatedRepairAt: string | null;
  outServiceAt: string | null;
  activeAssignment: MobilityAssignmentRecord | null;
  benefitAssignment: MobilityAssignmentRecord | null;
};

export type MobilityListPayload = {
  items: MobilityAssignmentRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export function mobilityStatusLabel(s: MobilityAssignmentStatus): string {
  const map: Record<MobilityAssignmentStatus, string> = {
    draft: "Ciornă",
    eligible: "Eligibil",
    reserved: "Rezervat",
    active: "Activ",
    returned: "Returnat",
    waived: "Renunțat",
    cancelled: "Anulat",
  };
  return map[s] ?? s;
}

export function mobilityDeliveryModeLabel(m: MobilityDeliveryMode): string {
  const map: Record<MobilityDeliveryMode, string> = {
    customer_pickup: "Ridicare client",
    delivered_to_customer: "Livrare la client",
    at_supplier: "La furnizor / service",
  };
  return map[m] ?? m;
}

export function computeImmobilizationHours(
  inServiceAt: string | null | undefined,
  estimatedRepairAt: string | null | undefined,
  outServiceAt: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!inServiceAt) return null;
  const start = new Date(inServiceAt);
  if (Number.isNaN(start.getTime())) return null;
  const endRaw = outServiceAt ?? estimatedRepairAt ?? now.toISOString();
  const end = new Date(endRaw);
  if (Number.isNaN(end.getTime())) return null;
  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  return Math.max(0, Math.round(hours * 10) / 10);
}

export function isMobilityEligible(
  inServiceAt: string | null | undefined,
  estimatedRepairAt: string | null | undefined,
  outServiceAt: string | null | undefined,
): boolean {
  const hours = computeImmobilizationHours(inServiceAt, estimatedRepairAt, outServiceAt);
  return hours !== null && hours > MOBILITY_ELIGIBILITY_HOURS;
}

function fmtMobilityDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("ro-RO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Rezumat beneficiu mobilitate pentru tichet / WO (data IN–OUT, nr., furnizor rent). */
export function formatMobilityBenefitSummary(m: MobilityAssignmentRecord): string {
  if (m.status === "waived") {
    return `Renunțare la mașină la schimb${m.waivedReason ? ` — ${m.waivedReason}` : ""}`;
  }
  const inDate = fmtMobilityDate(m.handoverAt);
  const outDate = fmtMobilityDate(m.returnedAt ?? (m.status === "active" ? null : m.expectedReturnAt));
  const period =
    inDate && outDate
      ? `${inDate} → ${outDate}`
      : inDate
        ? `din ${inDate}${m.status === "active" || m.status === "reserved" ? " (în curs)" : ""}`
        : outDate
          ? `până la ${outDate}`
          : null;
  const reg = m.replacementRegistration?.trim();
  const supplier = m.supplierLegalName?.trim();
  const parts = [
    period,
    reg ? `nr. ${reg}` : null,
    supplier ? `furnizor rent: ${supplier}` : null,
    m.deliveryMode ? mobilityDeliveryModeLabel(m.deliveryMode) : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : mobilityStatusLabel(m.status);
}
