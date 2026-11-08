import Link from "next/link";
import { notFound } from "next/navigation";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { getAuthMeResult, isPartnerAdminMode } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";
import {
  isPartnerViewAs,
  parsePartnerSupplierQuery,
  partnerSupplierSearchParams,
  appendPartnerSupplierQuery,
} from "@/lib/partner-context";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ supplierId?: string; suppliers?: string }>;
};

type TireRequestItem = {
  id: string;
  subject: string;
  status: string;
  kind: string;
  serviceLabel: string | null;
  plate: string | null;
  clientName: string | null;
  createdAt: string;
  hrefHotel: string;
  hrefWorkOrders: string;
  stayIds: string[];
};

async function loadRequest(
  ticketId: string,
  q: ReturnType<typeof parsePartnerSupplierQuery>,
): Promise<TireRequestItem | null> {
  try {
    const p = partnerSupplierSearchParams(q);
    const res = await fleetServerFetch(
      `/partner/tire-hotel/requests/${encodeURIComponent(ticketId)}?${p.toString()}`,
    );
    if (!res?.ok) return null;
    const data = (await res.json()) as { item?: TireRequestItem };
    return data.item ?? null;
  } catch {
    return null;
  }
}

export default async function PartnerTireRequestDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const supplierQuery = parsePartnerSupplierQuery(sp);
  const auth = await getAuthMeResult();
  const adminMode = auth.ok && isPartnerAdminMode(auth);
  const listHref = appendPartnerSupplierQuery("/fleet/partner/tire-requests", supplierQuery);

  if (adminMode && !isPartnerViewAs(supplierQuery)) {
    return (
      <FleetPageMain>
        <div className="px-4 py-4 lg:px-6">
          <h1 className="mb-2 text-lg font-semibold text-zinc-100">Solicitare anvelope</h1>
          <p className="rounded-xl border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/90">
            Selectează un furnizor din comutator pentru a vedea solicitarea.
          </p>
          <Link href={listHref} className="mt-3 inline-block text-sm text-sky-400 hover:underline">
            ← Înapoi la solicitări
          </Link>
        </div>
      </FleetPageMain>
    );
  }

  const item = await loadRequest(id, supplierQuery);
  if (!item) notFound();

  const kindLabel =
    item.kind === "storage"
      ? "Depozitare (hotel)"
      : item.kind === "service"
        ? "Înlocuire (service)"
        : (item.serviceLabel ?? "Anvelope");

  return (
    <FleetPageMain>
      <div className="mx-auto max-w-2xl px-4 py-4 lg:px-6">
        <Link href={listHref} className="text-xs text-zinc-500 hover:text-zinc-300">
          ← Solicitări anvelope
        </Link>
        <h1 className="mt-3 text-lg font-semibold text-zinc-100">{item.subject}</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Fișă partener — nu CRM flotă. Execuția se face din Hotel / Devize.
        </p>

        <dl className="mt-4 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-zinc-500">Vehicul</dt>
            <dd className="mt-0.5 font-medium text-zinc-100">{item.plate ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-zinc-500">Client</dt>
            <dd className="mt-0.5 text-zinc-200">{item.clientName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-zinc-500">Tip</dt>
            <dd className="mt-0.5 text-zinc-200">{kindLabel}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-zinc-500">Status</dt>
            <dd className="mt-0.5 text-zinc-200">{item.status}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[10px] uppercase tracking-wide text-zinc-500">Creat</dt>
            <dd className="mt-0.5 text-zinc-300">
              {new Date(item.createdAt).toLocaleString("ro-RO")}
            </dd>
          </div>
          {item.stayIds?.length ? (
            <div className="sm:col-span-2">
              <dt className="text-[10px] uppercase tracking-wide text-zinc-500">Stay hotel legate</dt>
              <dd className="mt-0.5 font-mono text-xs text-zinc-400">{item.stayIds.join(", ")}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          {item.kind === "storage" ? (
            <Link
              href={item.hrefHotel}
              className="rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-600"
            >
              Check-in hotel (cu context)
            </Link>
          ) : (
            <Link
              href={item.hrefWorkOrders}
              className="rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-600"
            >
              Devize & comenzi
            </Link>
          )}
          <Link
            href={appendPartnerSupplierQuery("/fleet/partner/tire-hotel", supplierQuery)}
            className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            Inventar hotel
          </Link>
        </div>
      </div>
    </FleetPageMain>
  );
}
