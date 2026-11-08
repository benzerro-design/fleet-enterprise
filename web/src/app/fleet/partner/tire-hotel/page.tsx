import Link from "next/link";
import { Suspense } from "react";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { PartnerTireHotelClient } from "@/components/fleet/partner/PartnerTireHotelClient";
import { PartnerTireHotelOverview } from "@/components/fleet/partner/PartnerTireHotelOverview";
import { canWritePartnerOps, getAuthMeResult, isPartnerAdminMode } from "@/lib/auth-server";
import {
  appendPartnerSupplierQuery,
  parsePartnerSupplierQuery,
} from "@/lib/partner-context";

type PageProps = {
  searchParams: Promise<{ supplierId?: string; suppliers?: string }>;
};

export default async function PartnerTireHotelInventarPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const supplierQuery = parsePartnerSupplierQuery(sp);
  const auth = await getAuthMeResult();
  const adminMode = auth.ok && isPartnerAdminMode(auth);
  const canWrite = auth.ok && !adminMode && canWritePartnerOps(auth);
  const checkInHref = appendPartnerSupplierQuery(
    "/fleet/partner/tire-hotel/check-in",
    supplierQuery,
  );

  return (
    <FleetPageMain>
      <div className="px-4 py-4 lg:px-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Inventar hotel</h1>
            <p className="mt-1 text-xs text-zinc-500">
              Listă tip flotă — sejururi pe raft. Check-in și import CSV sunt pe pagină separată.
            </p>
          </div>
          {!adminMode || supplierQuery.supplierId ? (
            <Link
              href={checkInHref}
              className="rounded-lg bg-violet-700 px-3 py-2 text-sm font-medium text-white hover:bg-violet-600"
            >
              Check-in / import
            </Link>
          ) : null}
        </div>
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
              mode="inventar"
            />
          </Suspense>
        )}
      </div>
    </FleetPageMain>
  );
}
