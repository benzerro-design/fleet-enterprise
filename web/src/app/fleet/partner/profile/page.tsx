import { canManageFleet, canWritePartnerOps, getAuthMeResult, isPartnerAdminMode } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";
import { parsePartnerSupplierQuery } from "@/lib/partner-context";
import { primarySupplierMembership } from "@/lib/partner-auth";
import { loadSupplierServiceCatalogServer } from "@/lib/suppliers-api-server";
import type { SupplierRecord } from "@/lib/suppliers-api";
import { PartnerProfileClient } from "./PartnerProfileClient";

async function loadSupplier(id: string): Promise<SupplierRecord | null> {
  try {
    const res = await fleetServerFetch(`/suppliers/${id}`);
    if (!res?.ok) return null;
    return (await res.json()) as SupplierRecord;
  } catch {
    return null;
  }
}

type PageProps = { searchParams: Promise<{ supplierId?: string; suppliers?: string }> };

export default async function PartnerProfilePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const supplierQuery = parsePartnerSupplierQuery(sp);
  const auth = await getAuthMeResult();
  const adminMode = auth.ok && isPartnerAdminMode(auth);
  const membership = auth.ok && !adminMode ? primarySupplierMembership(auth.me) : undefined;
  const supplierId = supplierQuery.supplierId ?? membership?.supplierId;

  const [supplier, serviceCatalog] = await Promise.all([
    supplierId ? loadSupplier(supplierId) : Promise.resolve(null),
    loadSupplierServiceCatalogServer(),
  ]);

  const canWriteServices = adminMode
    ? canManageFleet(auth)
    : canWritePartnerOps(auth);
  const canInvite = adminMode
    ? canManageFleet(auth)
    : membership?.role === "supplier_manager";

  return (
    <PartnerProfileClient
      supplierMembership={membership}
      supplier={supplier}
      serviceCatalog={serviceCatalog}
      tenantSlug={auth.ok ? auth.me.tenantSlug : "demo"}
      canWriteServices={canWriteServices}
      canInvite={canInvite}
    />
  );
}
