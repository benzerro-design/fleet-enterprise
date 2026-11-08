import { Suspense } from "react";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { PartnerTireHotelClient } from "@/components/fleet/partner/PartnerTireHotelClient";
import { PartnerTireHotelOverview } from "@/components/fleet/partner/PartnerTireHotelOverview";
import { canWritePartnerOps, getAuthMeResult, isPartnerAdminMode } from "@/lib/auth-server";
import { parsePartnerSupplierQuery } from "@/lib/partner-context";

type PageProps = {
  searchParams: Promise<{ supplierId?: string; suppliers?: string }>;
};

export default async function PartnerTireHotelPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const supplierQuery = parsePartnerSupplierQuery(sp);
  const auth = await getAuthMeResult();
  const adminMode = auth.ok && isPartnerAdminMode(auth);
  const canWrite = auth.ok && !adminMode && canWritePartnerOps(auth);

  return (
    <FleetPageMain>
      <div className="px-4 py-4 lg:px-6">
        <h1 className="mb-1 text-lg font-semibold text-zinc-100">Hotel anvelope</h1>
        <p className="mb-4 text-xs text-zinc-500">
          Check-in și eliberare seturi depozitate la furnizor. Fiecare set are cod{" "}
          <code className="font-mono text-zinc-400">FE:tire-set:&#123;id&#125;</code> — poți
          lipi codul în căutare sau copia pentru etichetă.
        </p>
        {adminMode && !supplierQuery.supplierId ? (
          <Suspense fallback={<p className="text-xs text-zinc-500">Se încarcă…</p>}>
            <PartnerTireHotelOverview />
          </Suspense>
        ) : (
          <Suspense fallback={<p className="text-xs text-zinc-500">Se încarcă…</p>}>
            <PartnerTireHotelClient
              canWrite={canWrite}
              adminMode={adminMode}
              supplierId={supplierQuery.supplierId}
            />
          </Suspense>
        )}
      </div>
    </FleetPageMain>
  );
}
