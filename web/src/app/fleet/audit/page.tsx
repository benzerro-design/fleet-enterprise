import Link from "next/link";
import { AuditDetailExpandable } from "@/components/fleet/AuditDetailExpandable";
import {
  AUDIT_ACTION_VALUES,
  AUDIT_ENTITY_TYPES,
  auditActionLabel,
  auditDetailText,
  auditEntityLabel,
  auditVehicleRegistrationFromMeta,
} from "@/lib/audit-display";
import { apiServerFetch } from "@/lib/fleet-server";

type AuditResponse = {
  total: number;
  page: number;
  pageSize: number;
  items: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    meta: unknown;
    createdAt: string;
    actorEmail: string | null;
    actorDisplayName: string | null;
  }>;
};

type AuditSearch = {
  page?: string;
  entityType?: string;
  action?: string;
};

function buildAuditQuery(sp: AuditSearch): string {
  const q = new URLSearchParams();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  q.set("page", String(page));
  q.set("pageSize", "50");
  if (sp.entityType?.trim()) q.set("entityType", sp.entityType.trim());
  if (sp.action?.trim()) q.set("action", sp.action.trim());
  return q.toString();
}

async function fetchAudit(sp: AuditSearch): Promise<AuditResponse | null> {
  const res = await apiServerFetch(`/tenant/audit-log?${buildAuditQuery(sp)}`);
  if (!res?.ok) return null;
  return (await res.json()) as AuditResponse;
}

function auditPageHref(sp: AuditSearch, page: number): string {
  const next = { ...sp, page: String(page) };
  const q = new URLSearchParams();
  q.set("page", next.page ?? "1");
  if (next.entityType?.trim()) q.set("entityType", next.entityType.trim());
  if (next.action?.trim()) q.set("action", next.action.trim());
  return `/fleet/audit?${q.toString()}`;
}

type Props = { searchParams: Promise<AuditSearch> };

export default async function FleetAuditPage({ searchParams }: Props) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const data = await fetchAudit(sp);

  const nextHref = auditPageHref(sp, page + 1);
  const prevHref = auditPageHref(sp, Math.max(1, page - 1));

  return (
    <div className="text-zinc-100">
      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Transparență</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Jurnal audit</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Filtrare după tip obiect și tip acțiune (server + paginare). Rezumat citibil; meta complet
              JSON, expandabil.
            </p>
          </div>
          <Link
            href="/fleet/vehicles"
            className="inline-flex w-fit rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            Înapoi la vehicule
          </Link>
        </div>

        <form
          action="/fleet/audit"
          method="get"
          className="mb-6 flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <input type="hidden" name="page" value="1" />
          <div className="flex min-w-[11rem] flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Tip obiect</label>
            <select
              name="entityType"
              defaultValue={sp.entityType ?? ""}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
            >
              <option value="">Toate tipurile</option>
              {AUDIT_ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {auditEntityLabel(t)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-[14rem] flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Acțiune</label>
            <select
              name="action"
              defaultValue={sp.action ?? ""}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
            >
              <option value="">Toate acțiunile</option>
              {AUDIT_ACTION_VALUES.map((a) => (
                <option key={a} value={a}>
                  {auditActionLabel(a)}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
          >
            Aplică filtre
          </button>
          <Link
            href="/fleet/audit"
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-900"
          >
            Resetează
          </Link>
        </form>

        {!data ? (
          <p className="text-amber-400">Nu am putut încărca jurnalul.</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-zinc-800">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-zinc-950 text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Când</th>
                    <th className="px-4 py-3">Acțiune</th>
                    <th className="px-4 py-3">Obiect</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="min-w-[16rem] px-4 py-3">Detaliu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {data.items.map((row) => {
                    const summary = auditDetailText(row.action, row.entityType, row.meta);
                    const entityKind = auditEntityLabel(row.entityType);
                    const registrationFromMeta = auditVehicleRegistrationFromMeta(row.meta);
                    const fleetRelatedObject =
                      row.entityType === "vehicle" ||
                      row.entityType === "trip" ||
                      row.entityType === "maintenance_entry" ||
                      row.entityType === "cost_entry";
                    const registration = fleetRelatedObject ? registrationFromMeta : null;
                    const detailHref =
                      row.entityType === "vehicle"
                        ? `/fleet/vehicles/${row.entityId}`
                        : row.entityType === "trip"
                          ? `/fleet/trips/${row.entityId}`
                          : row.entityType === "maintenance_entry"
                            ? `/fleet/maintenance/${row.entityId}`
                            : row.entityType === "cost_entry"
                              ? `/fleet/costs/${row.entityId}`
                              : null;
                    const detailLabel =
                      row.entityType === "vehicle"
                        ? "Deschide fișa vehiculului"
                        : row.entityType === "trip"
                          ? "Deschide cursa"
                          : row.entityType === "maintenance_entry"
                            ? "Deschide mentenanța"
                            : row.entityType === "cost_entry"
                              ? "Deschide costul"
                              : null;
                    return (
                      <tr key={row.id} className="bg-zinc-900/30 align-top">
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-400">
                          {new Date(row.createdAt).toLocaleString("ro-RO")}
                        </td>
                        <td className="px-4 py-3 text-zinc-100">{auditActionLabel(row.action)}</td>
                        <td className="px-4 py-3">
                          {fleetRelatedObject ? (
                            <>
                              <div
                                className="font-mono text-base font-semibold tracking-tight text-zinc-100"
                                title="Număr înmatriculare"
                              >
                                {registration ?? "—"}
                              </div>
                              <div className="mt-0.5 text-xs text-zinc-500">{entityKind}</div>
                              <div
                                className="mt-1 max-w-[14rem] cursor-help font-mono text-xs text-zinc-500"
                                title={`ID complet: ${row.entityId}`}
                              >
                                ID: {row.entityId.slice(0, 10)}…
                              </div>
                              {detailHref && detailLabel ? (
                                <Link
                                  href={detailHref}
                                  className="mt-1 inline-block text-xs text-emerald-400 hover:text-emerald-300 hover:underline"
                                >
                                  {detailLabel}
                                </Link>
                              ) : null}
                            </>
                          ) : (
                            <>
                              <div className="text-zinc-200">{entityKind}</div>
                              <div
                                className="mt-1 max-w-[14rem] cursor-help font-mono text-xs text-zinc-500"
                                title={`ID complet: ${row.entityId}`}
                              >
                                ID: {row.entityId.slice(0, 10)}…
                              </div>
                            </>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-300">
                          {row.actorDisplayName ? (
                            <>
                              <span>{row.actorDisplayName}</span>
                              <span className="mt-0.5 block text-xs text-zinc-500">{row.actorEmail}</span>
                            </>
                          ) : (
                            <span>{row.actorEmail ?? "—"}</span>
                          )}
                        </td>
                        <td className="max-w-xl px-4 py-3">
                          <AuditDetailExpandable summary={summary} meta={row.meta} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-between text-sm text-zinc-500">
              <span>
                Total {data.total} · pagina {data.page}
              </span>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Link href={prevHref} className="text-emerald-400 hover:underline">
                    ← Anterior
                  </Link>
                ) : null}
                {data.items.length >= data.pageSize ? (
                  <Link href={nextHref} className="text-emerald-400 hover:underline">
                    Următor →
                  </Link>
                ) : null}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
