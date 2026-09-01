export const partnerPendingActionsBrowserBase = "/api/partner/pending-actions";

export type PartnerPendingActionKind = "pending_approval" | "ready_uninvoiced" | "pending_supplier";

export type PartnerPendingAction = {
  id: string;
  kind: PartnerPendingActionKind;
  href: string;
  title: string;
  subtitle: string;
};

export type PartnerPendingActionsPayload = {
  items: PartnerPendingAction[];
  total: number;
};

export function partnerBrowserSupplierQuery(): string {
  if (typeof window === "undefined") return "";
  const id = new URLSearchParams(window.location.search).get("supplierId")?.trim();
  return id ? `?supplierId=${encodeURIComponent(id)}` : "";
}

/** Păstrează ?supplierId= pe linkurile din portal (view-as admin). */
export function withPartnerSupplierQuery(href: string): string {
  const q = partnerBrowserSupplierQuery();
  if (!q) return href;
  const supplierId = new URLSearchParams(q.slice(1)).get("supplierId");
  if (!supplierId) return href;
  const [path, search = ""] = href.split("?");
  const params = new URLSearchParams(search);
  if (!params.has("supplierId")) params.set("supplierId", supplierId);
  const s = params.toString();
  return s ? `${path}?${s}` : path;
}

export function partnerPendingActionKindLabel(kind: PartnerPendingActionKind | string): string {
  switch (kind) {
    case "pending_approval":
      return "Deviz așteaptă aprobare";
    case "ready_uninvoiced":
      return "Gata, nefacturat";
    case "pending_supplier":
      return "Programare de validat";
    default:
      return "Acțiune";
  }
}
