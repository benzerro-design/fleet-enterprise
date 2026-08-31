import Link from "next/link";
import { FilterResetLink } from "@/components/fleet/FilterResetLink";
import { FleetListPageLayout } from "@/components/fleet/FleetListPageLayout";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { WorkOrderDataGrid } from "@/components/fleet/work-orders/WorkOrderDataGrid";
import { WorkOrderKpiStrip } from "@/components/fleet/work-orders/WorkOrderKpiStrip";
import type { ClientListPayload } from "@/lib/clients-api";
import { filterFormKey } from "@/lib/filter-form-key";
import { fleetServerFetch } from "@/lib/fleet-server";
import type { SupplierListPayload } from "@/lib/suppliers-api";
import { getVehicleOptions } from "@/lib/vehicle-options-server";
import { SERVICE_ORDER_TYPES } from "@/lib/work-order-sheet";
import { getAuthMeResult, isClientPortalUser } from "@/lib/auth-server";
import {
  WORK_ORDER_STATUSES,
  type WorkOrderInbox,
  type WorkOrderListPayload,
  type WorkOrderStats,
  serviceCaseStageLabel,
} from "@/lib/work-orders-api";

type Search = {
  q?: string;
  status?: string;
  supplierId?: string;
  vehicleId?: string;
  clientId?: string;
  inbox?: string;
  serviceCaseStage?: string;
  serviceOrderType?: string;
  page?: string;
};

const SERVICE_CASE_STAGES = [
  "work_order",
  "in_service",
  "out_service",
  "quote",
  "approval",
  "cost",
  "invoiced",
] as const;

async function loadWorkOrders(sp: Search): Promise<WorkOrderListPayload | null> {
  const p = new URLSearchParams();
  if (sp.q?.trim()) p.set("q", sp.q.trim());
  if (sp.status?.trim()) p.set("status", sp.status.trim());
  if (sp.supplierId?.trim()) p.set("supplierId", sp.supplierId.trim());
  if (sp.vehicleId?.trim()) p.set("vehicleId", sp.vehicleId.trim());
  if (sp.clientId?.trim()) p.set("clientId", sp.clientId.trim());
  if (sp.serviceCaseStage?.trim()) p.set("serviceCaseStage", sp.serviceCaseStage.trim());
  if (sp.serviceOrderType?.trim()) p.set("serviceOrderType", sp.serviceOrderType.trim());
  const inbox = sp.inbox?.trim() || "open";
  if (inbox !== "all") p.set("inbox", inbox);
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

type PageProps = { searchParams: Promise<Search> };

function quickTabClass(active: boolean): string {
  return `rounded-lg px-3 py-1.5 text-sm ${
    active ? "bg-sky-600 text-white" : "border border-zinc-700 text-zinc-300 hover:bg-zinc-900"
  }`;
}

export default async function WorkOrdersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const auth = await getAuthMeResult();
  const clientScoped = isClientPortalUser(auth);
  const [list, stats, clients, suppliers, vehicles] = await Promise.all([
    loadWorkOrders(sp),
    loadStats(sp.clientId),
    loadClients(),
    loadSuppliers(),
    getVehicleOptions(),
  ]);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const activeInbox = (sp.inbox?.trim() || "open") as WorkOrderInbox | "all";

  const withParams = (overrides: Partial<Search>) => {
    const p = new URLSearchParams();
    const merged = { ...sp, ...overrides };
    if (merged.q?.trim()) p.set("q", merged.q.trim());
    if (merged.status?.trim()) p.set("status", merged.status.trim());
    if (merged.supplierId?.trim()) p.set("supplierId", merged.supplierId.trim());
    if (merged.vehicleId?.trim()) p.set("vehicleId", merged.vehicleId.trim());
    if (merged.clientId?.trim()) p.set("clientId", merged.clientId.trim());
    if (merged.serviceCaseStage?.trim()) p.set("serviceCaseStage", merged.serviceCaseStage.trim());
    if (merged.serviceOrderType?.trim()) p.set("serviceOrderType", merged.serviceOrderType.trim());
    if (merged.inbox?.trim()) p.set("inbox", merged.inbox.trim());
    if (merged.page && merged.page !== "1") p.set("page", merged.page);
    const qs = p.toString();
    return `/fleet/work-orders${qs ? `?${qs}` : ""}`;
  };

  const withPage = (next: number) => withParams({ page: String(next) });

  const filterParams: Record<string, string> = {};
  if (sp.q?.trim()) filterParams.q = sp.q.trim();
  if (sp.status?.trim()) filterParams.status = sp.status.trim();
  if (sp.clientId?.trim()) filterParams.clientId = sp.clientId.trim();
  if (sp.supplierId?.trim()) filterParams.supplierId = sp.supplierId.trim();
  if (sp.vehicleId?.trim()) filterParams.vehicleId = sp.vehicleId.trim();
  if (sp.serviceCaseStage?.trim()) filterParams.serviceCaseStage = sp.serviceCaseStage.trim();
  if (sp.serviceOrderType?.trim()) filterParams.serviceOrderType = sp.serviceOrderType.trim();
  if (sp.inbox?.trim()) filterParams.inbox = sp.inbox.trim();

  const vehicleOptions = sp.clientId?.trim()
    ? vehicles.filter((v) => v.clientId.toLowerCase() === sp.clientId!.trim().toLowerCase())
    : vehicles;

  const quickTabs: { label: string; inbox?: WorkOrderInbox | "all" }[] = [
    { label: "Deschise", inbox: "open" },
    { label: "Așteaptă aprobare", inbox: "pending_approval" },
    { label: "In service", inbox: "in_service" },
    { label: "Lucrare gata", inbox: "ready" },
    { label: "Facturate", inbox: "invoiced" },
    { label: "Toate", inbox: "all" },
  ];

  return (
    <FleetPageMain fill>
      <FleetListPageLayout
        header={
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-sky-400">Furnizori & Parteneri</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Devize & comenzi</h1>
            <p className="mt-3 max-w-2xl text-zinc-400">
              Comenzi de lucru service — flux tichet → programare → deviz → aprobare. Estimarea finalizării e
              obligatorie înainte de trimiterea devizului.
            </p>
          </div>
        }
        filters={
          <form
            key={filterFormKey(sp)}
            method="get"
            className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4"
          >
            {activeInbox !== "all" && activeInbox !== "open" ? (
              <input type="hidden" name="inbox" value={activeInbox} />
            ) : activeInbox === "open" ? (
              <input type="hidden" name="inbox" value="open" />
            ) : null}
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
              <label className="text-xs text-zinc-500">Status WO</label>
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
              <label className="text-xs text-zinc-500">Etapă dosar</label>
              <select
                name="serviceCaseStage"
                defaultValue={sp.serviceCaseStage ?? ""}
                className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="">Toate</option>
                {SERVICE_CASE_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {serviceCaseStageLabel(s)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500">Tip</label>
              <select
                name="serviceOrderType"
                defaultValue={sp.serviceOrderType ?? ""}
                className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="">Toate</option>
                {SERVICE_ORDER_TYPES.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.code} — {t.label}
                  </option>
                ))}
              </select>
            </div>
            {!clientScoped ? (
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
            ) : null}
            <div>
              <label className="text-xs text-zinc-500">Partener</label>
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
                className="mt-1 block max-w-[10rem] rounded-lg border border-zinc-700 bg-zinc-950 font-mono text-sm text-zinc-100"
              >
                <option value="">Toate</option>
                {vehicleOptions.map((v) => (
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
            <FilterResetLink href="/fleet/work-orders?inbox=open" />
          </form>
        }
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            {quickTabs.map((tab) => (
              <Link
                key={tab.label}
                href={withParams({
                  inbox: tab.inbox === "all" ? "all" : tab.inbox === "open" ? "open" : tab.inbox,
                  page: "1",
                })}
                className={quickTabClass(activeInbox === (tab.inbox ?? "all"))}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        }
      >
        {stats ? (
          <div className="mb-6">
            <WorkOrderKpiStrip stats={stats} />
          </div>
        ) : null}

        {!list ? (
          <p className="text-amber-400">Nu am putut încărca comenzile. Verifică API-ul și migrarea.</p>
        ) : list.items.length === 0 ? (
          <p className="text-zinc-500">
            Nicio comandă pentru filtrele curente. Pornește un dosar dintr-un tichet CRM și avansează la etapa
            „Comandă service”.
          </p>
        ) : (
          <>
            <WorkOrderDataGrid items={list.items} filterParams={filterParams} />
            {list.total > list.pageSize ? (
              <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
                <span>
                  Pagina {page} · {list.total} comenzi
                </span>
                <div className="flex gap-2">
                  {page > 1 ? (
                    <Link href={withPage(page - 1)} className="rounded border border-zinc-700 px-3 py-1 hover:bg-zinc-900">
                      Înapoi
                    </Link>
                  ) : null}
                  {page * list.pageSize < list.total ? (
                    <Link href={withPage(page + 1)} className="rounded border border-zinc-700 px-3 py-1 hover:bg-zinc-900">
                      Înainte
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        )}
      </FleetListPageLayout>
    </FleetPageMain>
  );
}
