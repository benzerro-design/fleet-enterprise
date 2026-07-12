import { canWritePartnerOps, getAuthMeResult } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";
import { primarySupplierMembership } from "@/lib/partner-auth";
import {
  loadSupplierServiceCatalogServer,
} from "@/lib/suppliers-api-server";
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

export default async function PartnerProfilePage() {
  const auth = await getAuthMeResult();
  const membership = auth.ok ? primarySupplierMembership(auth.me) : undefined;
  const [supplier, serviceCatalog] = await Promise.all([
    membership?.supplierId ? loadSupplier(membership.supplierId) : Promise.resolve(null),
    loadSupplierServiceCatalogServer(),
  ]);

  return (
    <PartnerProfileClient
      supplierMembership={membership}
      supplier={supplier}
      serviceCatalog={serviceCatalog}
      tenantSlug={auth.ok ? auth.me.tenantSlug : "demo"}
      canWriteServices={canWritePartnerOps(auth)}
    />
  );
}
