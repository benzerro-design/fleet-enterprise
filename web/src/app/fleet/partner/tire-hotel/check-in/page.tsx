import Link from "next/link";
import { Suspense } from "react";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { PartnerTireHotelClient } from "@/components/fleet/partner/PartnerTireHotelClient";
import { canWritePartnerOps, getAuthMeResult, isPartnerAdminMode } from "@/lib/auth-server";
import {
  appendPartnerSupplierQuery,
  parsePartnerSupplierQuery,
} from "@/lib/partner-context";

type PageProps = {
  searchParams: Promise<{
    supplierId?: string;
    suppliers?: string;
    plate?: string;
    ticketId?: string;
  }>;
};

export default async function PartnerTireHotelCheckInPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const supplierQuery = parsePartnerSupplierQuery(sp);
  const auth = await getAuthMeResult();
  const adminMode = auth.ok && isPartnerAdminMode(auth);
  const canWrite = auth.ok && !adminMode && canWritePartnerOps(auth);
  const inventarHref = appendPartnerSupplierQuery("/fleet/partner/tire-hotel", supplierQuery);

  if (adminMode && !supplierQuery.supplierId) {
    return (
      <FleetPageMain>
        <div className="px-4 py-4 lg:px-6">
          <h1 className="mb-2 text-lg font-semibold text-zinc-100">Check-in hotel</h1>
          <p className="rounded-xl border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/90">
            Selectează un furnizor din comutator pentru check-in.
          </p>
          <Link href={inventarHref} className="mt-3 inline-block text-sm text-sky-400 hover:underline">
            ← Inventar hotel
          </Link>
        </div>
      </FleetPageMain>
    );
  }

  return (
    <FleetPageMain>
      <div className="px-4 py-4 lg:px-6">
        <div className="mb-4">
          <Link href={inventarHref} className="text-xs text-sky-400 hover:underline">
            ← Inventar hotel
          </Link>
          <h1 className="mt-2 text-lg font-semibold text-zinc-100">Check-in / import</h1>
          <p className="mt-1 text-xs text-zinc-500">
            Cazare set pe raft sau import CSV. Inventarul rămâne pe pagina de listă.
            {sp.ticketId ? (
              <>
                {" "}
                Context tichet: <code className="text-zinc-400">{sp.ticketId}</code>
                {sp.plate ? (
                  <>
                    {" "}
                    · Nr. Înmatriculare solicitare:{" "}
                    <span className="text-zinc-300">{sp.plate}</span>
                  </>
                ) : null}
              </>
            ) : null}
          </p>
        </div>
        <Suspense fallback={<p className="text-xs text-zinc-500">Se încarcă…</p>}>
          <PartnerTireHotelClient
            canWrite={canWrite}
            adminMode={adminMode}
            supplierId={supplierQuery.supplierId}
            mode="check-in"
          />
        </Suspense>
      </div>
    </FleetPageMain>
  );
}
