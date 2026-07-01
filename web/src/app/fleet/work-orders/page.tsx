import Link from "next/link";
import {
  FleetDataTable,
  fleetTableClass,
  fleetTdClass,
  fleetThClass,
  fleetTheadClass,
} from "@/components/fleet/fleet-data-table";
import { FilterResetLink } from "@/components/fleet/FilterResetLink";
import { FleetListPageLayout } from "@/components/fleet/FleetListPageLayout";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { WorkOrderKpiStrip } from "@/components/fleet/work-orders/WorkOrderKpiStrip";
import { WorkOrderStatusBadge } from "@/components/fleet/work-orders/WorkOrderStatusBadge";
import type { ClientListPayload } from "@/lib/clients-api";
import { filterFormKey } from "@/lib/filter-form-key";
import { fleetServerFetch } from "@/lib/fleet-server";
import type { SupplierListPayload } from "@/lib/suppliers-api";
import { getVehicleOptions } from "@/lib/vehicle-options-server";
import {
  serviceCaseStageLabel,
  WORK_ORDER_STATUSES,
  workflowTypeLabel,
  type WorkOrderListPayload,
  type WorkOrderStats,
} from "@/lib/work-orders-api";

type Search = {
  q?: string;
  status?: string;
  supplierId?: string;
  vehicleId?: string;
  clientId?: string;
  page?: string;
};

async function loadWorkOrders(sp: Search): Promise<WorkOrderListPayload | null> {
  const p = new URLSearchParams();
  if (sp.q?.trim()) p.set("q", sp.q.trim());
  if (sp.status?.trim()) p.set("status", sp.status.trim());
  if (sp.supplierId?.trim()) p.set("supplierId", sp.supplierId.trim());
  if (sp.vehicleId?.trim()) p.set("vehicleId", sp.vehicleId.trim());
  if (sp.clientId?.trim()) p.set("clientId", sp.clientId.trim());
  p.set("page", String(Math.max(1, parseInt(sp.page ?? "1", 10) || 1)));
  p.set("pageSize", "50");
  try {
    const res = await fleetServerFetch(`/work-orders?${p.toString()}`);
    if (!res?.ok) return null;
    return (await res.json()) as WorkOrderListPayload;
  } catch {
    return null;
  }
}

async function loadStats(clientId?: string): Promise<WorkOrderStats | null> {
  const p = new URLSearchParams();
  if (clientId?.trim()) p.set("clientId", clientId.trim());
  try {
    const res = await fleetServerFetch(`/work-orders/stats?${p.toString()}`);
    if (!res?.ok) return null;
    return (await res.json()) as WorkOrderStats;
  } catch {
    return null;
  }
}

async function loadClients(): Promise<Array<{ id: string; code: string; legalName: string }>> {
  try {
    const res = await fleetServerFetch("/clients?status=active&pageSize=200");
    if (!res?.ok) return [];
    const data = (await res.json()) as ClientListPayload;
    return data.items.map((c) => ({ id: c.id, code: c.code, legalName: c.legalName }));
  } catch {
    return [];
  }
}

async function loadSuppliers(): Promise<Array<{ id: string; code: string; legalName: string }>> {
  try {
    const res = await fleetServerFetch("/suppliers?status=active&pageSize=200");
    if (!res?.ok) return [];
    const data = (await res.json()) as SupplierListPayload;
    return data.items.map((s) => ({ id: s.id, code: s.code, legalName: s.legalName }));
  } catch {
    return [];
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: "numeric" });
}

type PageProps = { searchParams: Promise<Search> };

export default async function WorkOrdersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const [list, stats, clients, suppliers, vehicles] = await Promise.all([
    loadWorkOrders(sp),
    loadStats(sp.clientId),
    loadClients(),
    loadSuppliers(),
    getVehicleOptions(),
  ]);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const withPage = (next: number) => {
    const p = new URLSearchParams();
    if (sp.q?.trim()) p.set("q", sp.q.trim());
    if (sp.status?.trim()) p.set("status", sp.status.trim());
    if (sp.supplierId?.trim()) p.set("supplierId", sp.supplierId.trim());
    if (sp.vehicleId?.trim()) p.set("vehicleId", sp.vehicleId.trim());
    if (sp.clientId?.trim()) p.set("clientId", sp.clientId.trim());
    p.set("page", String(next));
    return `/fleet/work-orders?${p.toString()}`;
  };

  return (
    <FleetPageMain fill>
      <FleetListPageLayout
        header={
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-widest text-sky-400">Furnizori & Parteneri</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Devize & comenzi</h1>
              <p className="mt-3 max-w-2xl text-zinc-400">
                Comenzi de lucru service legate de dosarele operaționale — flux tichet → programare → deviz.
              </p>
            </div>
            {stats ? <WorkOrderKpiStrip stats={stats} /> : null}
          </div>
        }
        filters={
          <form
            key={filterFormKey(sp)}
            method="get"
            className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4"
          >
            <div>
              <label className="text-xs text-zinc-500">Căutare</label>
              <input
                name="q"
                defaultValue={sp.q ?? ""}
                placeholder="titlu, nr. auto, furnizor"
                className="mt-1 block w-48 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500">Status</label>
              <select
                name="status"
                defaultValue={sp.status ?? ""}
                className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="">Toate</option>
                {WORK_ORDER_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500">Client</label>
              <select
                name="clientId"
                defaultValue={sp.clientId ?? ""}
                className="mt-1 block max-w-[12rem] rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="">Toți</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.legalName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500">Furnizor</label>
              <select
                name="supplierId"
                defaultValue={sp.supplierId ?? ""}
                className="mt-1 block max-w-[12rem] rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="">Toți</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.legalName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500">Vehicul</label>
              <select
                name="vehicleId"
                defaultValue={sp.vehicleId ?? ""}
                className="mt-1 block max-w-[10rem] rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100"
              >
                <option value="">Toate</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.registrationNumber}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
            >
              Filtrează
            </button>
            <FilterResetLink href="/fleet/work-orders" />
          </form>
        }
      >
        {!list ? (
          <p className="text-amber-400">Nu am putut încărca comenzile. Verifică API-ul și migrarea.</p>
        ) : list.items.length === 0 ? (
          <p className="text-zinc-500">
            Nicio comandă service. Pornește un dosar dintr-un tichet CRM și avansează la etapa „Comandă service”.
          </p>
        ) : (
          <>
            <FleetDataTable>
              <table className={fleetTableClass}>
                <thead className={`${fleetTheadClass} tracking-wide`}>
                  <tr>
                    <th className={fleetThClass}>Titlu</th>
                    <th className={fleetThClass}>Status</th>
                    <th className={fleetThClass}>Vehicul</th>
                    <th className={fleetThClass}>Client</th>
                    <th className={fleetThClass}>Furnizor</th>
                    <th className={fleetThClass}>Flux</th>
                    <th className={fleetThClass}>Tichet</th>
                    <th className={fleetThClass}>Actualizat</th>
                    <th className={fleetThClass} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {list.items.map((row) => (
                    <tr key={row.id} className="text-zinc-200">
                      <td className={fleetTdClass}>
                        <Link href={`/fleet/work-orders/${row.id}`} className="font-medium hover:text-emerald-200 hover:underline">
                          {row.title}
                        </Link>
                      </td>
                      <td className={fleetTdClass}>
                        <WorkOrderStatusBadge status={row.status} />
                      </td>
                      <td className={`${fleetTdClass} font-mono text-sm`}>
                        <Link href={`/fleet/vehicles/${row.vehicleId}`} className="text-sky-300/90 hover:underline">
                          {row.registrationNumber}
                        </Link>
                      </td>
                      <td className={`${fleetTdClass} text-sm`}>
                        {row.clientCode}
                        <span className="block text-xs text-zinc-500">{row.clientLegalName}</span>
                      </td>
                      <td className={fleetTdClass}>{row.supplierLegalName ?? "—"}</td>
                      <td className={`${fleetTdClass} text-xs text-zinc-400`}>
                        {workflowTypeLabel(row.workflowType)}
                        <span className="block">{serviceCaseStageLabel(row.serviceCaseStage)}</span>
                      </td>
                      <td className={`${fleetTdClass} font-mono text-sm`}>
                        {row.sourceTicketId && row.ticketDisplayId ? (
                          <Link href={`/fleet/tickets/${row.sourceTicketId}`} className="text-emerald-400 hover:underline">
                            #{row.ticketDisplayId}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={`${fleetTdClass} text-sm text-zinc-400`}>{formatDate(row.updatedAt)}</td>
                      <td className={`${fleetTdClass} text-right`}>
                        <Link href={`/fleet/work-orders/${row.id}`} className="text-zinc-400 hover:text-zinc-200 hover:underline">
                          Detalii
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </FleetDataTable>
            {list.total > list.pageSize ? (
              <div className="mt-4 flex gap-2 text-sm">
                {page > 1 ? (
                  <Link href={withPage(page - 1)} className="text-emerald-400 hover:underline">
                    ← Anterior
                  </Link>
                ) : null}
                <span className="text-zinc-500">
                  Pagina {page} · {list.total} comenzi
                </span>
                {page * list.pageSize < list.total ? (
                  <Link href={withPage(page + 1)} className="text-emerald-400 hover:underline">
                    Următor →
                  </Link>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </FleetListPageLayout>
    </FleetPageMain>
  );
}
