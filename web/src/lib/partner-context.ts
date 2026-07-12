export type PartnerSupplierQuery = {
  supplierId?: string;
  suppliers?: string[];
};

export function parsePartnerSupplierQuery(
  sp: Record<string, string | undefined>,
): PartnerSupplierQuery {
  const supplierId = sp.supplierId?.trim() || undefined;
  const suppliersRaw = sp.suppliers?.trim();
  const suppliers = suppliersRaw
    ? suppliersRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;
  return { supplierId, suppliers };
}

export function partnerSupplierIds(q: PartnerSupplierQuery): string[] | undefined {
  if (q.suppliers?.length) return q.suppliers;
  if (q.supplierId) return [q.supplierId];
  return undefined;
}

export function isPartnerViewAs(q: PartnerSupplierQuery): boolean {
  return Boolean(q.supplierId || q.suppliers?.length);
}

export function appendPartnerSupplierQuery(path: string, q: PartnerSupplierQuery): string {
  const [pathname, existingSearch = ""] = path.split("?");
  const params = new URLSearchParams(existingSearch);
  params.delete("supplierId");
  params.delete("suppliers");
  if (q.suppliers?.length) {
    params.set("suppliers", q.suppliers.join(","));
  } else if (q.supplierId) {
    params.set("supplierId", q.supplierId);
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function partnerSupplierSearchParams(q: PartnerSupplierQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (q.suppliers?.length) p.set("suppliers", q.suppliers.join(","));
  else if (q.supplierId) p.set("supplierId", q.supplierId);
  return p;
}

export function mergePartnerQueryIntoParams(
  base: URLSearchParams,
  q: PartnerSupplierQuery,
): URLSearchParams {
  const merged = new URLSearchParams(base.toString());
  merged.delete("supplierId");
  merged.delete("suppliers");
  const extra = partnerSupplierSearchParams(q);
  extra.forEach((v, k) => merged.set(k, v));
  return merged;
}
