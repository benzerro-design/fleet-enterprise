import { Suspense } from "react";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { PartnerWarehousesClient } from "@/components/fleet/partner/PartnerWarehousesClient";
import { canWritePartnerOps, getAuthMeResult, isPartnerAdminMode } from "@/lib/auth-server";
import { parsePartnerSupplierQuery } from "@/lib/partner-context";

type PageProps = {
  searchParams: Promise<{ supplierId?: string; suppliers?: string }>;
};

export default async function PartnerWarehousesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const supplierQuery = parsePartnerSupplierQuery(sp);
  const auth = await getAuthMeResult();
  const adminMode = auth.ok && isPartnerAdminMode(auth);
  const canWrite = auth.ok && !adminMode && canWritePartnerOps(auth);

  return (
    <FleetPageMain>
      <div className="px-4 py-4 lg:px-6">
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-zinc-100">Depozite</h1>
          <p className="mt-1 text-xs text-zinc-500">
            Structură master: depozit → zonă → rând → locație. Etichete QR pe locație (pachet 1.1b).
          </p>
        </div>
        <Suspense fallback={<p className="text-xs text-zinc-500">Se încarcă…</p>}>
          <PartnerWarehousesClient
            canWrite={canWrite}
            adminMode={adminMode}
            supplierId={supplierQuery.supplierId}
          />
        </Suspense>
      </div>
    </FleetPageMain>
  );
}
