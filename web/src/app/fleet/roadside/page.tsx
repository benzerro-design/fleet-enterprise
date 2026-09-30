import Link from "next/link";
import { FilterResetLink } from "@/components/fleet/FilterResetLink";
import { FleetListDisplayScope } from "@/components/fleet/FleetListDisplayScope";
import { FleetListPageLayout } from "@/components/fleet/FleetListPageLayout";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { filterFormKey } from "@/lib/filter-form-key";
import { fleetServerFetch } from "@/lib/fleet-server";
import {
  ROADSIDE_KINDS,
  ROADSIDE_STATUSES,
  type RoadsideListPayload,
  isRoadsideActive,
  roadsideKindLabel,
  roadsideStatusLabel,
} from "@/lib/roadside-api";

type Search = {
  page?: string;
  status?: string;
  kind?: string;
};

function buildQuery(sp: Search): string {
  const q = new URLSearchParams();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  q.set("page", String(page));
  q.set("pageSize", "20");
  if (sp.status?.trim()) q.set("status", sp.status.trim());
  if (sp.kind?.trim()) q.set("kind", sp.kind.trim());
  return q.toString();
}

async function fetchRows(sp: Search): Promise<RoadsideListPayload | null> {
  const res = await fleetServerFetch(`/roadside/interventions?${buildQuery(sp)}`);
  if (!res?.ok) return null;
  return (await res.json()) as RoadsideListPayload;
}

type Props = { searchParams: Promise<Search> };

export default async function FleetRoadsidePage({ searchParams }: Props) {
  const sp = await searchParams;
  const data = await fetchRows(sp);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));

  const withPage = (nextPage: number) => {
    const p = new URLSearchParams();
    p.set("page", String(nextPage));
    if (sp.status?.trim()) p.set("status", sp.status.trim());
    if (sp.kind?.trim()) p.set("kind", sp.kind.trim());
    return `/fleet/roadside?${p.toString()}`;
  };

  return (
    <FleetPageMain fill>
      <FleetListPageLayout
        header={
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Operațional</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Asistență rutieră</h1>
              <p className="mt-3 max-w-xl text-sm text-zinc-400">
                Intervenții înregistrate pe dosare — tractare, pornire, anvelope etc. Deschide tichetul sursă când există.
              </p>
            </div>
            <Link
              href="/fleet/tickets"
              className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
            >
              Tichete CRM
            </Link>
          </div>
        }
        filters={
          <form
            key={filterFormKey(sp)}
            action="/fleet/roadside"
            method="get"
            className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:flex-row sm:flex-wrap sm:items-end"
          >
            <input type="hidden" name="page" value="1" />
            <div className="flex min-w-[10rem] flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">Status</label>
              <select
                name="status"
                defaultValue={sp.status ?? ""}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              >
                <option value="">Toate</option>
                {ROADSIDE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {roadsideStatusLabel(s)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-[10rem] flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">Tip intervenție</label>
              <select
                name="kind"
                defaultValue={sp.kind ?? ""}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              >
                <option value="">Toate</option>
                {ROADSIDE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {roadsideKindLabel(k)}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="rounded-lg bg-zinc-800 px-4 py-2 text-sm">
              Aplică
            </button>
            <FilterResetLink href="/fleet/roadside" />
          </form>
        }
      >
        {!data ? (
          <p className="text-amber-400">Nu am putut încărca intervențiile.</p>
        ) : data.items.length === 0 ? (
          <p className="text-zinc-400">Nu există intervenții pentru filtrele curente.</p>
        ) : (
          <>
            <FleetListDisplayScope>
              <div className="fleet-list-card-stack space-y-3">
                {data.items.map((row) => (
                  <article key={row.id} className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="text-base font-semibold text-zinc-100">
                          {roadsideKindLabel(row.kind)}
                          {row.displayNumber ? (
                            <span className="ml-2 font-mono text-sm font-normal text-zinc-400">
                              {row.displayNumber}
                            </span>
                          ) : null}
                        </h2>
                        <p className="mt-1 text-sm text-zinc-300">{roadsideStatusLabel(row.status)}</p>
                        {isRoadsideActive(row.status) ? (
                          <p className="mt-1 text-xs text-emerald-400/90">Intervenție activă / recentă</p>
                        ) : null}
                      </div>
                      <div className="text-right text-xs text-zinc-500">
                        <p className="font-mono">{row.vehicleReg ?? "—"}</p>
                        <p className="mt-1">{row.clientLegalName}</p>
                      </div>
                    </div>
                    <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3" data-fleet-list-extra>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-zinc-500">Locație</dt>
                        <dd>{row.locationText ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-zinc-500">Furnizor</dt>
                        <dd>{row.supplierLegalName ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-zinc-500">Solicitat</dt>
                        <dd>
                          {row.requestedAt
                            ? new Date(row.requestedAt).toLocaleString("ro-RO")
                            : "—"}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {row.sourceTicketId ? (
                        <Link
                          href={`/fleet/tickets/${row.sourceTicketId}`}
                          className="rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-950/50"
                        >
                          Tichet sursă
                        </Link>
                      ) : row.serviceCaseId ? (
                        <Link
                          href={`/fleet/tickets?inbox=open`}
                          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-100 hover:bg-zinc-800"
                          title={`Dosar: ${row.serviceCaseId}`}
                        >
                          Dosar service
                        </Link>
                      ) : null}
                      {row.workOrderId ? (
                        <Link
                          href={`/fleet/work-orders/${row.workOrderId}`}
                          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-100 hover:bg-zinc-800"
                        >
                          Comandă service
                        </Link>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </FleetListDisplayScope>
            {totalPages > 1 ? (
              <nav className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm" aria-label="Paginare">
                {page > 1 ? (
                  <Link href={withPage(page - 1)} className="rounded border border-zinc-700 px-3 py-1 hover:bg-zinc-900">
                    Înapoi
                  </Link>
                ) : null}
                <span className="text-zinc-500">
                  Pagina {page} / {totalPages} ({data.total} total)
                </span>
                {page < totalPages ? (
                  <Link href={withPage(page + 1)} className="rounded border border-zinc-700 px-3 py-1 hover:bg-zinc-900">
                    Înainte
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </>
        )}
      </FleetListPageLayout>
    </FleetPageMain>
  );
}
