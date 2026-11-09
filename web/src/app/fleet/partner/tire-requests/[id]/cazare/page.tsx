import Link from "next/link";
import { Suspense } from "react";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { PartnerCazareExecuteClient } from "@/components/fleet/partner/PartnerCazareExecuteClient";
import {
  canWritePartnerOps,
  getAuthMeResult,
  isPartnerAdminMode,
} from "@/lib/auth-server";
import {
  appendPartnerSupplierQuery,
  isPartnerViewAs,
  parsePartnerSupplierQuery,
} from "@/lib/partner-context";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ supplierId?: string; suppliers?: string; stayId?: string }>;
};

export default async function PartnerCazareExecutePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const supplierQuery = parsePartnerSupplierQuery(sp);
  const auth = await getAuthMeResult();
  const adminMode = auth.ok && isPartnerAdminMode(auth);
  const canWrite =
    auth.ok &&
    ((adminMode && isPartnerViewAs(supplierQuery) && canWritePartnerOps(auth)) ||
      (!adminMode && canWritePartnerOps(auth)));
  const detailHref = appendPartnerSupplierQuery(
    `/fleet/partner/tire-requests/${id}`,
    supplierQuery,
  );

  if (adminMode && !isPartnerViewAs(supplierQuery)) {
    return (
      <FleetPageMain>
        <div className="px-4 py-4 lg:px-6">
          <h1 className="mb-2 text-lg font-semibold text-zinc-100">Execută cazarea</h1>
          <p className="rounded-xl border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/90">
            Selectează un furnizor din comutator pentru a executa cazarea.
          </p>
          <Link href={detailHref} className="mt-3 inline-block text-sm text-sky-400 hover:underline">
            ← Înapoi la solicitare
          </Link>
        </div>
      </FleetPageMain>
    );
  }

  return (
    <FleetPageMain>
      <div className="px-4 py-4 lg:px-6">
        <Suspense fallback={<p className="text-sm text-zinc-500">Se încarcă…</p>}>
          <PartnerCazareExecuteClient ticketId={id} canWrite={canWrite} />
        </Suspense>
      </div>
    </FleetPageMain>
  );
}
