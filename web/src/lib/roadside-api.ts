import { fleetJsonHeaders } from "@/lib/fleet-api";

export const roadsideBrowserBase = "/api/roadside";
export { fleetJsonHeaders };

export type RoadsideInterventionKind =
  | "tow"
  | "jump_start"
  | "tire_change"
  | "lockout"
  | "fuel_delivery"
  | "other";

export type RoadsideInterventionStatus =
  | "draft"
  | "requested"
  | "dispatched"
  | "on_site"
  | "completed"
  | "cancelled";

export const ROADSIDE_KINDS: RoadsideInterventionKind[] = [
  "tow",
  "jump_start",
  "tire_change",
  "lockout",
  "fuel_delivery",
  "other",
];

export const ROADSIDE_STATUSES: RoadsideInterventionStatus[] = [
  "draft",
  "requested",
  "dispatched",
  "on_site",
  "completed",
  "cancelled",
];

export type RsaEntitlementStatus =
  | "covered"
  | "partial"
  | "out_of_plan"
  | "pay_per_use";

export type RoadsideInterventionRecord = {
  id: string;
  displayNumber: string | null;
  serviceCaseId: string;
  sourceTicketId: string | null;
  workOrderId: string | null;
  clientId: string;
  clientLegalName: string;
  vehicleId: string | null;
  vehicleReg: string | null;
  supplierId: string | null;
  supplierLegalName: string | null;
  kind: RoadsideInterventionKind;
  status: RoadsideInterventionStatus;
  locationText: string | null;
  requestedAt: string | null;
  dispatchedAt: string | null;
  onSiteAt: string | null;
  completedAt: string | null;
  notes: string | null;
  entitlementStatus: RsaEntitlementStatus;
  enrollmentId: string | null;
  entitlementNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RsaEntitlementResult = {
  status: RsaEntitlementStatus;
  enrollmentId: string | null;
  planId: string | null;
  planCode: string | null;
  planName: string | null;
  supplierId: string | null;
  featureIncluded: boolean;
  interventionsUsedCount: number | null;
  maxInterventionsPerYear: number | null;
  includedTowKm: number | null;
  overagePerKmCents: number | null;
  note: string;
};

export type RoadsideListPayload = {
  items: RoadsideInterventionRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export function roadsideKindLabel(kind: RoadsideInterventionKind | string): string {
  const map: Record<string, string> = {
    tow: "Tractare",
    jump_start: "Pornire acumulator",
    tire_change: "Schimbare roată",
    lockout: "Deblocare",
    fuel_delivery: "Alimentare",
    other: "Altele",
  };
  return map[kind] ?? kind;
}

export function roadsideStatusLabel(status: RoadsideInterventionStatus | string): string {
  const map: Record<string, string> = {
    draft: "Ciornă",
    requested: "Solicitată",
    dispatched: "Dispecerizată",
    on_site: "Pe loc",
    completed: "Finalizată",
    cancelled: "Anulată",
  };
  return map[status] ?? status;
}

export function rsaEntitlementLabel(status: RsaEntitlementStatus | string): string {
  const map: Record<string, string> = {
    covered: "Acoperit",
    partial: "Parțial / overage",
    out_of_plan: "Out-of-plan",
    pay_per_use: "Pay-per-use",
  };
  return map[status] ?? status;
}

export function isRoadsideActive(status: RoadsideInterventionStatus | string): boolean {
  return status === "requested" || status === "dispatched" || status === "on_site" || status === "completed";
}

// ——— RSA-S0 ———

export type RsaEnrollmentStatus =
  | "pending_sync"
  | "active"
  | "suspended"
  | "expired"
  | "cancelled";

export type RsaSupplierProfileRecord = {
  id: string;
  supplierId: string;
  is24x7: boolean;
  dispatchPhone24x7: string | null;
  dispatchEmail: string | null;
  coverageCounties: string[];
  crossBorderEnabled: boolean;
  supportedKinds: string[];
  slaAckMinutes: number;
  slaArrivalUrbanMinutes: number;
  slaArrivalHighwayMinutes: number;
  baseCalloutOutPlanCents: number;
  towHookOutPlanCents: number;
  towPerKmOutPlanCents: number;
  winchSurchargeCents: number;
  nightWeekendMultiplierPct: number;
  brokerOutboundEnabled: boolean;
  brokerApiBaseUrl: string | null;
  brokerApiKeyLast4: string | null;
  brokerInboundEnabled: boolean;
  brokerInboundSecretLast4: string | null;
  brokerAutoDispatch: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RsaBrokerEventRecord = {
  id: string;
  supplierId: string;
  interventionId: string | null;
  missionId: string | null;
  direction: "outbound" | "inbound";
  eventType: string;
  status: "pending" | "sent" | "accepted" | "failed" | "received" | "dry_run";
  externalRef: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RsaPlanRecord = {
  id: string;
  supplierId: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  monthlyFeePerVehicleCents: number;
  features: Record<string, boolean>;
  includedTowKm: number;
  maxInterventionsPerYear: number | null;
  overagePerKmCents: number;
  mobilityIncluded: boolean;
  mobilityMaxDays: number | null;
  mobilityTriggerHours: number | null;
  mobilityVehicleClass: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RsaEnrollmentRecord = {
  id: string;
  clientId: string;
  clientLegalName: string;
  vehicleId: string;
  vehicleReg: string | null;
  planId: string;
  planCode: string;
  planName: string;
  supplierId: string;
  supplierLegalName: string;
  status: RsaEnrollmentStatus;
  externalSubscriptionNo: string | null;
  validFrom: string;
  validUntil: string | null;
  interventionsUsedCount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export function rsaEnrollmentStatusLabel(status: RsaEnrollmentStatus | string): string {
  const map: Record<string, string> = {
    pending_sync: "Sincronizare",
    active: "Activ",
    suspended: "Suspendat",
    expired: "Expirat",
    cancelled: "Anulat",
  };
  return map[status] ?? status;
}

export function centsToRon(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}

export function ronToCents(raw: string): number {
  const n = Number(String(raw).replace(",", ".").trim());
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

async function roadsideJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${roadsideBrowserBase}${path}`, {
    ...init,
    headers: { ...fleetJsonHeaders(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

export async function loadRsaEntitlement(params: {
  kind: RoadsideInterventionKind;
  vehicleId?: string | null;
  supplierId?: string | null;
  clientId?: string | null;
}): Promise<RsaEntitlementResult> {
  const qs = new URLSearchParams();
  qs.set("kind", params.kind);
  if (params.vehicleId) qs.set("vehicleId", params.vehicleId);
  if (params.supplierId) qs.set("supplierId", params.supplierId);
  if (params.clientId) qs.set("clientId", params.clientId);
  return roadsideJson(`/entitlement?${qs.toString()}`);
}

export async function loadRsaProfile(supplierId: string): Promise<RsaSupplierProfileRecord | null> {
  return roadsideJson(`/suppliers/${supplierId}/profile`);
}

export async function saveRsaProfile(
  supplierId: string,
  body: Partial<RsaSupplierProfileRecord> & {
    coverageCounties?: string[];
    supportedKinds?: string[];
    brokerApiKey?: string | null;
    brokerInboundSecret?: string | null;
  },
): Promise<RsaSupplierProfileRecord> {
  return roadsideJson(`/suppliers/${supplierId}/profile`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function dispatchRsaBroker(
  interventionId: string,
): Promise<RsaBrokerEventRecord> {
  return roadsideJson(`/interventions/${interventionId}/broker-dispatch`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function loadRsaBrokerEvents(params?: {
  interventionId?: string;
  supplierId?: string;
  pageSize?: number;
}): Promise<{ items: RsaBrokerEventRecord[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.interventionId) qs.set("interventionId", params.interventionId);
  if (params?.supplierId) qs.set("supplierId", params.supplierId);
  qs.set("pageSize", String(params?.pageSize ?? 20));
  return roadsideJson(`/broker/events?${qs.toString()}`);
}

export async function loadRsaPlans(supplierId: string): Promise<RsaPlanRecord[]> {
  const data = await roadsideJson<{ items: RsaPlanRecord[] }>(`/suppliers/${supplierId}/plans`);
  return data.items;
}

export async function createRsaPlan(
  supplierId: string,
  body: {
    code: string;
    name: string;
    description?: string | null;
    monthlyFeePerVehicleCents?: number;
    includedTowKm?: number;
    maxInterventionsPerYear?: number | null;
    overagePerKmCents?: number;
    mobilityIncluded?: boolean;
    features?: Record<string, boolean>;
  },
): Promise<RsaPlanRecord> {
  return roadsideJson(`/suppliers/${supplierId}/plans`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function patchRsaPlan(
  planId: string,
  body: Partial<{
    name: string;
    description: string | null;
    active: boolean;
    monthlyFeePerVehicleCents: number;
    includedTowKm: number;
    maxInterventionsPerYear: number | null;
    overagePerKmCents: number;
    mobilityIncluded: boolean;
    features: Record<string, boolean>;
  }>,
): Promise<RsaPlanRecord> {
  return roadsideJson(`/plans/${planId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function loadRsaEnrollments(params: {
  vehicleId?: string;
  clientId?: string;
  supplierId?: string;
  status?: RsaEnrollmentStatus;
  page?: number;
  pageSize?: number;
}): Promise<{ items: RsaEnrollmentRecord[]; total: number }> {
  const qs = new URLSearchParams();
  if (params.vehicleId) qs.set("vehicleId", params.vehicleId);
  if (params.clientId) qs.set("clientId", params.clientId);
  if (params.supplierId) qs.set("supplierId", params.supplierId);
  if (params.status) qs.set("status", params.status);
  qs.set("page", String(params.page ?? 1));
  qs.set("pageSize", String(params.pageSize ?? 50));
  return roadsideJson(`/enrollments?${qs.toString()}`);
}

export async function createRsaEnrollment(body: {
  vehicleId: string;
  planId: string;
  validFrom: string;
  validUntil?: string | null;
  externalSubscriptionNo?: string | null;
  notes?: string | null;
  status?: RsaEnrollmentStatus;
}): Promise<RsaEnrollmentRecord> {
  return roadsideJson(`/enrollments`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function patchRsaEnrollment(
  id: string,
  body: Partial<{
    status: RsaEnrollmentStatus;
    validFrom: string;
    validUntil: string | null;
    externalSubscriptionNo: string | null;
    notes: string | null;
  }>,
): Promise<RsaEnrollmentRecord> {
  return roadsideJson(`/enrollments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

// ——— RSA-S2 / S2b ———

export type RsaMissionStatus =
  | "assigned"
  | "en_route"
  | "on_scene"
  | "picked_up"
  | "in_transit"
  | "delivered"
  | "closed"
  | "cancelled";

export type RsaHandoverKind = "pickup" | "dropoff";
export type RsaHandoverProtocolStatus = "draft" | "signed" | "voided";
export type RsaHandoverSignerRole = "driver" | "customer" | "receiver" | "witness";
export type RsaHandoverMediaKind =
  | "front"
  | "rear"
  | "left"
  | "right"
  | "damage"
  | "interior"
  | "odometer"
  | "other";

export type RsaSettlementBreakdown = {
  amountCents: number;
  billableKm: number;
  includedKmApplied: number;
  mode: "covered_zero" | "covered_overage" | "partial_overage" | "rate_card";
  entitlementStatus: string;
  kind: string;
  distanceKm: number;
  lines: Array<{ code: string; label: string; cents: number }>;
};

export type RsaMissionRecord = {
  id: string;
  interventionId: string;
  interventionDisplayNumber: string | null;
  clientId: string;
  clientLegalName: string;
  vehicleId: string | null;
  vehicleReg: string | null;
  supplierId: string;
  supplierLegalName: string;
  driverUserId: string | null;
  driverDisplayName: string | null;
  platformPlate: string | null;
  status: RsaMissionStatus;
  pickupLocationText: string | null;
  dropoffLocationText: string | null;
  etaMinutes: number | null;
  distanceKm: number | null;
  settlementCostEntryId: string | null;
  settledAt: string | null;
  settlementAmountCents: number | null;
  settlementBreakdown: RsaSettlementBreakdown | null;
  protocols: Array<{
    id: string;
    kind: RsaHandoverKind;
    status: RsaHandoverProtocolStatus;
    signatureCount: number;
    mediaCount: number;
    signedAt: string | null;
  }>;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RsaSettlementResult = {
  mission: RsaMissionRecord;
  costEntryId: string;
  amountCents: number;
  breakdown: RsaSettlementBreakdown;
  idempotent: boolean;
};

export type RsaProtocolRecord = {
  id: string;
  missionId: string;
  kind: RsaHandoverKind;
  status: RsaHandoverProtocolStatus;
  locationText: string | null;
  odometerKm: number | null;
  fuelLevelPct: number | null;
  damageNotes: string | null;
  inventoryNotes: string | null;
  checklist: Record<string, boolean>;
  counterpartyName: string | null;
  counterpartyRoleNote: string | null;
  signedAt: string | null;
  signatures: Array<{
    id: string;
    role: RsaHandoverSignerRole;
    displayName: string;
    signedAt: string;
    signaturePngUrl: string;
  }>;
  media: Array<{
    id: string;
    kind: RsaHandoverMediaKind;
    fileUrl: string;
    fileName: string | null;
    caption: string | null;
    capturedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export function rsaMissionStatusLabel(status: RsaMissionStatus | string): string {
  const map: Record<string, string> = {
    assigned: "Alocată",
    en_route: "În drum",
    on_scene: "La fața locului",
    picked_up: "Preluată",
    in_transit: "În tranzit",
    delivered: "Predată",
    closed: "Închisă",
    cancelled: "Anulată",
  };
  return map[status] ?? status;
}

export function rsaHandoverKindLabel(kind: RsaHandoverKind | string): string {
  return kind === "pickup" ? "PV preluare" : kind === "dropoff" ? "PV predare" : kind;
}

export async function loadRsaMissions(params?: {
  interventionId?: string;
  supplierId?: string;
  status?: RsaMissionStatus;
  pageSize?: number;
}): Promise<{ items: RsaMissionRecord[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.interventionId) qs.set("interventionId", params.interventionId);
  if (params?.supplierId) qs.set("supplierId", params.supplierId);
  if (params?.status) qs.set("status", params.status);
  qs.set("pageSize", String(params?.pageSize ?? 50));
  return roadsideJson(`/missions?${qs.toString()}`);
}

export async function loadRsaMission(id: string): Promise<RsaMissionRecord> {
  return roadsideJson(`/missions/${id}`);
}

export async function createRsaMission(body: {
  interventionId: string;
  driverDisplayName?: string | null;
  platformPlate?: string | null;
  pickupLocationText?: string | null;
  dropoffLocationText?: string | null;
  etaMinutes?: number | null;
  notes?: string | null;
}): Promise<RsaMissionRecord> {
  return roadsideJson(`/missions`, { method: "POST", body: JSON.stringify(body) });
}

export async function patchRsaMission(
  id: string,
  body: Partial<{
    status: RsaMissionStatus;
    driverDisplayName: string | null;
    platformPlate: string | null;
    pickupLocationText: string | null;
    dropoffLocationText: string | null;
    etaMinutes: number | null;
    notes: string | null;
    cancelReason: string | null;
    distanceKm: number | null;
  }>,
): Promise<RsaMissionRecord> {
  return roadsideJson(`/missions/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export async function previewRsaSettlement(
  id: string,
  params?: { distanceKm?: number; applyNightWeekend?: boolean; applyWinch?: boolean },
): Promise<{
  missionId: string;
  distanceKm: number;
  breakdown: RsaSettlementBreakdown;
  alreadySettled: boolean;
  settlementCostEntryId: string | null;
}> {
  const qs = new URLSearchParams();
  if (params?.distanceKm != null) qs.set("distanceKm", String(params.distanceKm));
  if (params?.applyNightWeekend) qs.set("applyNightWeekend", "1");
  if (params?.applyWinch) qs.set("applyWinch", "1");
  const q = qs.toString();
  return roadsideJson(`/missions/${id}/settlement${q ? `?${q}` : ""}`);
}

export async function settleRsaMission(
  id: string,
  body?: {
    distanceKm?: number | null;
    applyNightWeekend?: boolean;
    applyWinch?: boolean;
  },
): Promise<RsaSettlementResult> {
  return roadsideJson(`/missions/${id}/settle`, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}

export async function openRsaProtocol(
  missionId: string,
  kind: RsaHandoverKind,
): Promise<RsaProtocolRecord> {
  return roadsideJson(`/missions/${missionId}/protocols/${kind}`, { method: "POST" });
}

export async function loadRsaProtocol(id: string): Promise<RsaProtocolRecord> {
  return roadsideJson(`/protocols/${id}`);
}

export async function patchRsaProtocol(
  id: string,
  body: Partial<{
    locationText: string | null;
    odometerKm: number | null;
    fuelLevelPct: number | null;
    damageNotes: string | null;
    inventoryNotes: string | null;
    checklist: Record<string, boolean>;
    counterpartyName: string | null;
    counterpartyRoleNote: string | null;
  }>,
): Promise<RsaProtocolRecord> {
  return roadsideJson(`/protocols/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export async function addRsaSignature(
  protocolId: string,
  body: {
    role: RsaHandoverSignerRole;
    displayName: string;
    signaturePngUrl: string;
    strokePathJson?: unknown;
    deviceMetaJson?: unknown;
  },
): Promise<RsaProtocolRecord> {
  return roadsideJson(`/protocols/${protocolId}/signatures`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function addRsaMedia(
  protocolId: string,
  body: {
    kind: RsaHandoverMediaKind;
    fileUrl: string;
    fileName?: string | null;
    caption?: string | null;
  },
): Promise<RsaProtocolRecord> {
  return roadsideJson(`/protocols/${protocolId}/media`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function finalizeRsaProtocol(protocolId: string): Promise<RsaProtocolRecord> {
  return roadsideJson(`/protocols/${protocolId}/finalize`, { method: "POST" });
}

export function rsaProtocolPdfUrl(protocolId: string): string {
  return `${roadsideBrowserBase}/protocols/${protocolId}/pdf`;
}
