import Link from "next/link";
import { notFound } from "next/navigation";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { getAuthMeResult, isPartnerAdminMode } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";
import {
  appendPartnerSupplierQuery,
  parsePartnerSupplierQuery,
  partnerSupplierSearchParams,
} from "@/lib/partner-context";
import { tireRequestKindLabel, tireRequestStatusLabel } from "@/lib/tire-gestiune";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ supplierId?: string; suppliers?: string }>;
};

type TireRequestItem = {
  id: string;
  displayId?: string;
  subject: string;
  description?: string | null;
  status: string;
  kind: string;
  kindLabel?: string;
  serviceLabel: string | null;
  gestiuneOp?: string | null;
  plate: string | null;
  clientName: string | null;
  supplierName?: string | null;
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

  const item = await loadRequest(id, supplierQuery);
  if (!item) notFound();

  const kindLabel =
    item.kindLabel ?? tireRequestKindLabel(item.kind, item.serviceLabel);

  return (
    <FleetPageMain>
      <div className="mx-auto max-w-2xl px-4 py-4 lg:px-6">
        <Link href={listHref} className="text-xs text-zinc-500 hover:text-zinc-300">
          ← Solicitări anvelope
        </Link>
        <div className="mt-3 flex flex-wrap items-baseline gap-2">
          <span className="font-mono text-xs text-zinc-500">
            #{item.displayId ?? item.id.slice(-6).toUpperCase()}
          </span>
          <h1 className="text-lg font-semibold text-zinc-100">{item.subject}</h1>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Fișă solicitare gestiune — fără mișcare stoc în acest pas. PV și check-in vin în
          pachetele următoare.
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
            <dd className="mt-0.5 text-zinc-200">{tireRequestStatusLabel(item.status)}</dd>
          </div>
          {item.supplierName || adminMode ? (
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-zinc-500">Partener</dt>
              <dd className="mt-0.5 text-zinc-200">{item.supplierName ?? "—"}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-zinc-500">Creat</dt>
            <dd className="mt-0.5 text-zinc-300">
              {new Date(item.createdAt).toLocaleString("ro-RO")}
            </dd>
          </div>
          {item.description ? (
            <div className="sm:col-span-2">
              <dt className="text-[10px] uppercase tracking-wide text-zinc-500">Note</dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-zinc-300">{item.description}</dd>
            </div>
          ) : null}
          {item.stayIds?.length ? (
            <div className="sm:col-span-2">
              <dt className="text-[10px] uppercase tracking-wide text-zinc-500">Stay hotel legate</dt>
              <dd className="mt-0.5 font-mono text-xs text-zinc-400">{item.stayIds.join(", ")}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={listHref}
            className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            Înapoi la coadă
          </Link>
          {item.kind === "storage" || item.gestiuneOp === "cazare" ? (
            <Link
              href={item.hrefHotel}
              className="rounded-lg border border-violet-800/50 bg-violet-950/20 px-4 py-2.5 text-sm text-violet-100"
            >
              Hotel (pregătire check-in)
            </Link>
          ) : null}
        </div>
      </div>
    </FleetPageMain>
  );
}
