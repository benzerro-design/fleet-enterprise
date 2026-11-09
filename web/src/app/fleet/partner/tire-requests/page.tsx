import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import {
  PartnerTireRequestsClient,
  type TireRequestItem,
} from "@/components/fleet/partner/PartnerTireRequestsClient";
import { getAuthMeResult, isPartnerAdminMode } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";
import {
  isPartnerViewAs,
  parsePartnerSupplierQuery,
  partnerSupplierSearchParams,
} from "@/lib/partner-context";

type PageProps = {
  searchParams: Promise<{ supplierId?: string; suppliers?: string }>;
};

async function loadRequests(
  q: ReturnType<typeof parsePartnerSupplierQuery>,
): Promise<TireRequestItem[]> {
  try {
    const p = partnerSupplierSearchParams(q);
    const res = await fleetServerFetch(`/partner/tire-hotel/requests?${p.toString()}`);
    if (!res?.ok) return [];
    const data = (await res.json()) as { items?: TireRequestItem[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

export default async function PartnerTireRequestsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const supplierQuery = parsePartnerSupplierQuery(sp);
  const auth = await getAuthMeResult();
  const adminMode = auth.ok && isPartnerAdminMode(auth);
  const viewAs = isPartnerViewAs(supplierQuery);

  // Admin pe „toți” — API deja suportă tenant-wide; afișăm overview fără ecran gol.
  const items = await loadRequests(supplierQuery);
  // Partener: supplier din JWT. Admin: doar în view-as pe un furnizor.
  const canCreate =
    auth.ok &&
    (auth.me.role === "supplier_user" ||
      (adminMode && Boolean(supplierQuery.supplierId || supplierQuery.suppliers?.length === 1)));

  return (
    <FleetPageMain>
      <div className="px-4 py-4 lg:px-6">
        {adminMode && !viewAs ? (
          <p className="mb-3 rounded-xl border border-sky-900/40 bg-sky-950/20 px-4 py-2 text-xs text-sky-100/90">
            Vizualizare pe toți furnizorii. Selectează un furnizor din comutator pentru a crea o
            solicitare în numele lui.
          </p>
        ) : null}
        <PartnerTireRequestsClient
          initialItems={items}
          supplierQuery={supplierQuery}
          canCreate={canCreate}
          showSupplierColumn={adminMode && !viewAs}
        />
      </div>
    </FleetPageMain>
  );
}
