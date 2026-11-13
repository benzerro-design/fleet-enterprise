export type TireCustodyProtocolKind =
  | "check_in"
  | "check_out"
  | "seasonal"
  | "transfer"
  | "scrap"
  | "leasing_return"
  | "quarantine";
export type TireCustodyProtocolStatus = "draft" | "signed" | "voided";
export type TireCustodySignerRole = "partner" | "customer" | "driver" | "witness";
export type TireCustodyMediaKind = "intake" | "condition" | "label" | "other";

export type TireCustodyProtocolRecord = {
  id: string;
  stayId: string;
  setId: string;
  supplierId: string;
  workOrderId: string | null;
  kind: TireCustodyProtocolKind;
  revision: number;
  status: TireCustodyProtocolStatus;
  locationText: string | null;
  conditionNotes: string | null;
  inventoryNotes: string | null;
  checklist: Record<string, boolean>;
  counterpartyName: string | null;
  counterpartyRoleNote: string | null;
  signedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  pdfSha256: string | null;
  pdfArchivedAt: string | null;
  hasArchivedPdf: boolean;
  hasDriverInvite: boolean;
  driverInviteExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  plate: string | null;
  setName: string | null;
  season: string | null;
  signatures: Array<{
    id: string;
    role: TireCustodySignerRole;
    displayName: string;
    signedAt: string;
    signaturePngUrl: string;
  }>;
  media: Array<{
    id: string;
    kind: TireCustodyMediaKind;
    fileUrl: string;
    fileName: string | null;
    caption: string | null;
    capturedAt: string;
  }>;
};

const base = "/api/partner/tire-hotel";

async function custodyJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { message?: string | string[] };
      if (typeof j.message === "string") msg = j.message;
      else if (Array.isArray(j.message)) msg = j.message.join(", ");
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function supplierQs(supplierId?: string | null): string {
  const sid = supplierId?.trim();
  return sid ? `?supplierId=${encodeURIComponent(sid)}` : "";
}

export function tireCustodyKindLabel(kind: TireCustodyProtocolKind): string {
  if (kind === "check_in") return "PV check-in";
  if (kind === "check_out") return "PV check-out";
  if (kind === "seasonal") return "PV schimb sezonier";
  if (kind === "transfer") return "PV transfer";
  if (kind === "scrap") return "PV casare";
  if (kind === "leasing_return") return "PV returnare leasing";
  if (kind === "quarantine") return "PV carantină";
  return kind;
}

export function tireCustodyRoleLabel(role: TireCustodySignerRole): string {
  if (role === "partner") return "Partener hotel";
  if (role === "customer") return "Client";
  if (role === "driver") return "Șofer";
  return "Martor";
}

export async function openTireCustodyProtocol(
  stayId: string,
  kind: TireCustodyProtocolKind,
  supplierId?: string | null,
  body?: { workOrderId?: string | null },
): Promise<TireCustodyProtocolRecord> {
  return custodyJson(`/stays/${stayId}/protocols/${kind}${supplierQs(supplierId)}`, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}

export async function listTireCustodyProtocols(
  stayId: string,
  supplierId?: string | null,
): Promise<TireCustodyProtocolRecord[]> {
  const data = await custodyJson<{ items?: TireCustodyProtocolRecord[] }>(
    `/stays/${stayId}/protocols${supplierQs(supplierId)}`,
  );
  return data.items ?? [];
}

export async function patchTireCustodyProtocol(
  protocolId: string,
  body: Partial<{
    locationText: string | null;
    conditionNotes: string | null;
    inventoryNotes: string | null;
    checklist: Record<string, boolean>;
    counterpartyName: string | null;
    counterpartyRoleNote: string | null;
    workOrderId: string | null;
  }>,
): Promise<TireCustodyProtocolRecord> {
  return custodyJson(`/protocols/${protocolId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function addTireCustodySignature(
  protocolId: string,
  body: {
    role: TireCustodySignerRole;
    displayName: string;
    signaturePngUrl: string;
    strokePathJson?: unknown;
    deviceMetaJson?: unknown;
  },
): Promise<TireCustodyProtocolRecord> {
  return custodyJson(`/protocols/${protocolId}/signatures`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function addTireCustodyMedia(
  protocolId: string,
  body: {
    kind: TireCustodyMediaKind;
    fileUrl: string;
    fileName?: string | null;
    caption?: string | null;
  },
): Promise<TireCustodyProtocolRecord> {
  return custodyJson(`/protocols/${protocolId}/media`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function finalizeTireCustodyProtocol(
  protocolId: string,
): Promise<TireCustodyProtocolRecord> {
  return custodyJson(`/protocols/${protocolId}/finalize`, { method: "POST" });
}

export async function voidTireCustodyProtocol(
  protocolId: string,
  voidReason: string,
): Promise<TireCustodyProtocolRecord> {
  return custodyJson(`/protocols/${protocolId}/void`, {
    method: "POST",
    body: JSON.stringify({ voidReason }),
  });
}

export async function createTireCustodyDriverInvite(
  protocolId: string,
  opts?: { email?: string | null; phone?: string | null },
): Promise<{
  protocolId: string;
  url: string;
  otp: string;
  expiresAt: string;
  protocol: TireCustodyProtocolRecord;
  emailSent?: boolean;
  emailError?: string | null;
  smsSent?: boolean;
  smsError?: string | null;
}> {
  return custodyJson(`/protocols/${protocolId}/driver-invite`, {
    method: "POST",
    body: JSON.stringify({
      email: opts?.email?.trim() || undefined,
      phone: opts?.phone?.trim() || undefined,
    }),
  });
}

export function tireCustodyProtocolPdfUrl(protocolId: string): string {
  return `${base}/protocols/${protocolId}/pdf`;
}
