import Link from "next/link";
import { FilterResetLink } from "@/components/fleet/FilterResetLink";
import { FleetListPageLayout } from "@/components/fleet/FleetListPageLayout";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { WorkOrderDataGrid } from "@/components/fleet/work-orders/WorkOrderDataGrid";
import { WorkOrderKpiStrip } from "@/components/fleet/work-orders/WorkOrderKpiStrip";
import { filterFormKey } from "@/lib/filter-form-key";
import { fleetServerFetch } from "@/lib/fleet-server";
import {
  appendPartnerSupplierQuery,
  mergePartnerQueryIntoParams,
  parsePartnerSupplierQuery,
  partnerSupplierSearchParams,
} from "@/lib/partner-context";
import { getVehicleOptions } from "@/lib/vehicle-options-server";
import { SERVICE_ORDER_TYPES } from "@/lib/work-order-sheet";
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
  vehicleId?: string;
  inbox?: string;
  serviceCaseStage?: string;
  serviceOrderType?: string;
  page?: string;
  supplierId?: string;
  suppliers?: string;
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

const BASE = "/fleet/partner/work-orders";

async function loadWorkOrders(sp: Search): Promise<WorkOrderListPayload | null> {
  const supplierQuery = parsePartnerSupplierQuery(sp);
  const p = mergePartnerQueryIntoParams(new URLSearchParams(), supplierQuery);
  if (sp.q?.trim()) p.set("q", sp.q.trim());
  if (sp.status?.trim()) p.set("status", sp.status.trim());
  if (sp.vehicleId?.trim()) p.set("vehicleId", sp.vehicleId.trim());
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

async function loadStats(sp: Search): Promise<WorkOrderStats | null> {
  const supplierQuery = parsePartnerSupplierQuery(sp);
  const p = partnerSupplierSearchParams(supplierQuery);
  try {
    const res = await fleetServerFetch(`/work-orders/stats?${p.toString()}`);
    if (!res?.ok) return null;
    return (await res.json()) as WorkOrderStats;
  } catch {
    return null;
  }
}

type PageProps = { searchParams: Promise<Search> };

function quickTabClass(active: boolean): string {
  return `rounded-lg px-3 py-1.5 text-sm ${
    active ? "bg-violet-600 text-white" : "border border-zinc-700 text-zinc-300 hover:bg-zinc-900"
  }`;
}

export default async function PartnerWorkOrdersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const [list, stats, vehicles] = await Promise.all([loadWorkOrders(sp), loadStats(sp), getVehicleOptions()]);
  const supplierQuery = parsePartnerSupplierQuery(sp);

  const withParams = (overrides: Partial<Search>) => {
    const merged = { ...sp, ...overrides };
    const p = mergePartnerQueryIntoParams(new URLSearchParams(), supplierQuery);
    if (merged.q?.trim()) p.set("q", merged.q.trim());
    if (merged.status?.trim()) p.set("status", merged.status.trim());
    if (merged.vehicleId?.trim()) p.set("vehicleId", merged.vehicleId.trim());
    if (merged.serviceCaseStage?.trim()) p.set("serviceCaseStage", merged.serviceCaseStage.trim());
    if (merged.serviceOrderType?.trim()) p.set("serviceOrderType", merged.serviceOrderType.trim());
    if (merged.inbox?.trim()) p.set("inbox", merged.inbox.trim());
    if (merged.page && merged.page !== "1") p.set("page", merged.page);
    const qs = p.toString();
    return `${BASE}${qs ? `?${qs}` : ""}`;
  };

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const activeInbox = (sp.inbox?.trim() || "open") as WorkOrderInbox | "all";
  const withPage = (next: number) => withParams({ page: String(next) });

  const filterParams: Record<string, string> = {};
  if (sp.q?.trim()) filterParams.q = sp.q.trim();
  if (sp.status?.trim()) filterParams.status = sp.status.trim();
  if (sp.vehicleId?.trim()) filterParams.vehicleId = sp.vehicleId.trim();
  if (sp.serviceCaseStage?.trim()) filterParams.serviceCaseStage = sp.serviceCaseStage.trim();
  if (sp.serviceOrderType?.trim()) filterParams.serviceOrderType = sp.serviceOrderType.trim();
  if (sp.inbox?.trim()) filterParams.inbox = sp.inbox.trim();
  if (supplierQuery.supplierId) filterParams.supplierId = supplierQuery.supplierId;
  if (supplierQuery.suppliers?.length) filterParams.suppliers = supplierQuery.suppliers.join(",");

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
            <p className="text-sm font-medium uppercase tracking-widest text-violet-400">Portal partener</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Devize & comenzi</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Aceeași interfață ca în aplicația flotă — filtrată automat pe furnizorul dvs. Fără selector Partener.
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
            {supplierQuery.supplierId ? (
              <input type="hidden" name="supplierId" value={supplierQuery.supplierId} />
            ) : null}
            {supplierQuery.suppliers?.length ? (
              <input type="hidden" name="suppliers" value={supplierQuery.suppliers.join(",")} />
            ) : null}
            <div>
              <label className="text-xs text-zinc-500">Căutare</label>
              <input
                name="q"
                defaultValue={sp.q ?? ""}
                placeholder="titlu, nr. auto"
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
            <div>
              <label className="text-xs text-zinc-500">Vehicul</label>
              <select
                name="vehicleId"
                defaultValue={sp.vehicleId ?? ""}
                className="mt-1 block max-w-[10rem] rounded-lg border border-zinc-700 bg-zinc-950 font-mono text-sm text-zinc-100"
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
            <FilterResetLink href={appendPartnerSupplierQuery(`${BASE}?inbox=open`, supplierQuery)} />
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
        ) : (
          <>
            {list.items.length === 0 ? (
              <p className="mb-3 text-sm text-zinc-500">
                Nicio comandă pentru filtrele / furnizorul curent. Lista rămâne aici — schimbă filtrul sau
                furnizorul, nu se pierde scope-ul.
              </p>
            ) : null}
            <WorkOrderDataGrid
              items={list.items}
              filterParams={filterParams}
              workOrdersBasePath={BASE}
              partnerView
            />
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
