"use client";

import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { SupplierProfileTabs } from "@/components/fleet/suppliers/SupplierProfileTabs";
import type { SupplierMembershipMe } from "@/lib/auth-server";
import type { SupplierRecord } from "@/lib/suppliers-api";
import type { SupplierServiceCatalogEntry } from "@/lib/supplier-service-catalog";

type Props = {
  supplierMembership?: SupplierMembershipMe;
  supplier: SupplierRecord | null;
  serviceCatalog: SupplierServiceCatalogEntry[];
  tenantSlug: string;
  canWriteServices: boolean;
};

export function PartnerProfileClient({
  supplierMembership,
  supplier,
  serviceCatalog,
  tenantSlug,
  canWriteServices,
}: Props) {
  return (
    <FleetPageMain>
      <div>
        <p className="text-sm font-medium uppercase tracking-widest text-violet-400">Portal partener</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Profil firmă</h1>
        <p className="mt-2 text-sm text-zinc-400">
          {supplier?.legalName ?? supplierMembership?.supplierLegalName ?? "Furnizor"} ·{" "}
          {supplier?.code ?? supplierMembership?.supplierCode ?? "—"} · tenant {tenantSlug}
        </p>
      </div>

      <div className="mt-6">
        <SupplierProfileTabs
          supplier={supplier}
          serviceCatalog={serviceCatalog}
          tenantSlug={tenantSlug}
          supplierMembership={supplierMembership}
          canWriteServices={canWriteServices}
          assignedByLabel="Partener / flotă"
        />
      </div>
    </FleetPageMain>
  );
}
