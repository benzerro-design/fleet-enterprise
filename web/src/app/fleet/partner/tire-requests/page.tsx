import Link from "next/link";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
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
  hrefTicket: string;
  stayIds: string[];
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

  if (adminMode && !isPartnerViewAs(supplierQuery)) {
    return (
      <FleetPageMain>
        <div className="px-4 py-4 lg:px-6">
          <h1 className="mb-2 text-lg font-semibold text-zinc-100">Solicitări anvelope</h1>
          <p className="rounded-xl border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/90">
            Selectează un furnizor (sau un subset) din comutator pentru a vedea coada de solicitări.
          </p>
        </div>
      </FleetPageMain>
    );
  }

  const items = await loadRequests(supplierQuery);

  return (
    <FleetPageMain>
      <div className="px-4 py-4 lg:px-6">
        <h1 className="mb-1 text-lg font-semibold text-zinc-100">Solicitări anvelope</h1>
        <p className="mb-4 text-xs text-zinc-500">
          Tichete deschise de depozitare sau înlocuire pentru clienții alocați furnizorului. Hotel =
          check-in; Service = WO / atelier.
        </p>
        {items.length === 0 ? (
          <p className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-6 text-sm text-zinc-500">
            Nicio solicitare deschisă.
          </p>
        ) : (
          <ul className="space-y-1">
            {items.map((it) => (
              <li
                key={it.id}
                className="flex flex-col gap-1.5 rounded-lg border border-zinc-800/90 bg-zinc-950/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-zinc-100">{it.subject}</p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    {it.plate ?? "—"} · {it.clientName ?? "—"} ·{" "}
                    {it.kind === "storage"
                      ? "Depozitare"
                      : it.kind === "service"
                        ? "Înlocuire"
                        : (it.serviceLabel ?? "Anvelope")}{" "}
                    · {it.status}
                    {it.stayIds?.length ? " · stay legat" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {it.kind === "storage" ? (
                    <Link
                      href={it.hrefHotel}
                      className="rounded-md border border-violet-800/50 bg-violet-950/30 px-2 py-1 text-[11px] text-violet-100"
                    >
                      Deschide Hotel
                    </Link>
                  ) : (
                    <Link
                      href={it.hrefWorkOrders}
                      className="rounded-md border border-sky-800/50 bg-sky-950/30 px-2 py-1 text-[11px] text-sky-100"
                    >
                      Devize & comenzi
                    </Link>
                  )}
                  <Link
                    href={it.hrefTicket}
                    className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300"
                  >
                    Tichet
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FleetPageMain>
  );
}
