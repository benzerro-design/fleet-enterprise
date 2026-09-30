"use client";

import { SupplierProfileShell } from "@/components/fleet/suppliers/SupplierProfileShell";
import type { SupplierMembershipMe } from "@/lib/auth-server";
import type { SupplierRecord } from "@/lib/suppliers-api";
import type { SupplierServiceCatalogEntry } from "@/lib/supplier-service-catalog";

type Props = {
  supplierMembership?: SupplierMembershipMe;
  supplier: SupplierRecord | null;
  serviceCatalog: SupplierServiceCatalogEntry[];
  tenantSlug: string;
  canWriteServices: boolean;
  canInvite?: boolean;
};

export function PartnerProfileClient({
  supplierMembership,
  supplier,
  serviceCatalog,
  tenantSlug,
  canWriteServices,
  canInvite = false,
}: Props) {
  return (
    <SupplierProfileShell
      mode="partner"
      supplier={supplier}
      serviceCatalog={serviceCatalog}
      tenantSlug={tenantSlug}
      supplierMembership={supplierMembership}
      canWriteServices={canWriteServices}
      canInviteTeam={canInvite}
      assignedByLabel="Partener / flotă"
    />
  );
}
