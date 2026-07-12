import Link from "next/link";
import { PartnerAdminOverview } from "@/components/fleet/partner/PartnerAdminOverview";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { WorkOrderKpiStrip } from "@/components/fleet/work-orders/WorkOrderKpiStrip";
import {
  getAuthMeResult,
  isPartnerAdminMode,
} from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";
import type { PartnerAdminOverview as PartnerAdminOverviewType } from "@/lib/partner-api";
import {
  isPartnerViewAs,
  parsePartnerSupplierQuery,
  partnerSupplierSearchParams,
} from "@/lib/partner-context";
import { primarySupplierMembership } from "@/lib/partner-auth";
import type { SupplierRecord } from "@/lib/suppliers-api";
import type { AppointmentStats } from "@/lib/appointments-api";
import type { WorkOrderListPayload, WorkOrderStats } from "@/lib/work-orders-api";

type Search = { supplierId?: string; suppliers?: string; inbox?: string };

function supplierQueryString(q: ReturnType<typeof parsePartnerSupplierQuery>): string {
  const p = partnerSupplierSearchParams(q);
  const s = p.toString();
  return s ? `?${s}` : "";
}

async function loadAdminOverview(q: ReturnType<typeof parsePartnerSupplierQuery>): Promise<PartnerAdminOverviewType | null> {
  try {
    const p = partnerSupplierSearchParams(q);
    const res = await fleetServerFetch(`/partner/admin/overview?${p.toString()}`);
    if (!res?.ok) return null;
    return (await res.json()) as PartnerAdminOverviewType;
  } catch {
    return null;
  }
}

async function loadStats(q: ReturnType<typeof parsePartnerSupplierQuery>): Promise<WorkOrderStats | null> {
  try {
    const p = partnerSupplierSearchParams(q);
    const res = await fleetServerFetch(`/work-orders/stats?${p.toString()}`);
    if (!res?.ok) return null;
    return (await res.json()) as WorkOrderStats;
  } catch {
    return null;
  }
}

async function loadAppointmentStats(q: ReturnType<typeof parsePartnerSupplierQuery>): Promise<AppointmentStats | null> {
  try {
    const p = partnerSupplierSearchParams(q);
    const res = await fleetServerFetch(`/appointments/stats?${p.toString()}`);
    if (!res?.ok) return null;
    return (await res.json()) as AppointmentStats;
  } catch {
    return null;
  }
}

async function loadRecentOrders(q: ReturnType<typeof parsePartnerSupplierQuery>): Promise<WorkOrderListPayload | null> {
  try {
    const p = new URLSearchParams({ inbox: "open", pageSize: "6" });
    partnerSupplierSearchParams(q).forEach((v, k) => p.set(k, v));
    const res = await fleetServerFetch(`/work-orders?${p.toString()}`);
    if (!res?.ok) return null;
    return (await res.json()) as WorkOrderListPayload;
  } catch {
    return null;
  }
}

async function loadSupplierById(id: string): Promise<SupplierRecord | null> {
  try {
    const res = await fleetServerFetch(`/suppliers/${id}`);
    if (!res?.ok) return null;
    return (await res.json()) as SupplierRecord;
  } catch {
    return null;
  }
}

function kpiCard(
  href: string,
  label: string,
  value: number,
  sub: string,
  warn?: boolean,
) {
  return (
    <Link
      href={href}
      className={`rounded-lg border p-3 transition-colors hover:bg-zinc-900/50 ${
        warn ? "border-amber-800/50 bg-amber-950/20" : "border-zinc-800 bg-zinc-900/30"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-zinc-100">{value}</p>
      <p className="mt-1 text-[10px] text-zinc-500">{sub}</p>
    </Link>
  );
}

type PageProps = { searchParams: Promise<Search> };

export default async function PartnerDashboardPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const supplierQuery = parsePartnerSupplierQuery(sp);
  const qs = supplierQueryString(supplierQuery);

  const auth = await getAuthMeResult();
  const adminMode = auth.ok && isPartnerAdminMode(auth);

  if (adminMode && !isPartnerViewAs(supplierQuery)) {
    const overview = await loadAdminOverview(supplierQuery);
    if (overview) return <PartnerAdminOverview overview={overview} />;
  }

  const [stats, apptStats, recent, viewAsSupplier] = await Promise.all([
    loadStats(supplierQuery),
    loadAppointmentStats(supplierQuery),
    loadRecentOrders(supplierQuery),
    supplierQuery.supplierId ? loadSupplierById(supplierQuery.supplierId) : Promise.resolve(null),
  ]);

  const supplier = auth.ok
    ? viewAsSupplier
      ? { supplierLegalName: viewAsSupplier.legalName, supplierCode: viewAsSupplier.code }
      : primarySupplierMembership(auth.me)
    : undefined;
  const displayName = auth.ok ? auth.me.email?.split("@")[0] ?? "Partener" : "Partener";
  const today = new Date().toLocaleDateString("ro-RO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const s = stats ?? {
    open: 0,
    inProgress: 0,
    waitingParts: 0,
    done: 0,
    pendingApproval: 0,
    readyUninvoiced: 0,
  };

  const woBase = `/fleet/partner/work-orders${qs}`;

  return (
    <FleetPageMain>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Panou de control</p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-100">Bun venit, {displayName}</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {supplier?.supplierLegalName ?? "Furnizor"} · {today}
        </p>
      </div>

      <div className="mt-8">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Operațional — comenzi</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpiCard(`${woBase}${woBase.includes("?") ? "&" : "?"}inbox=open`, "Deschise", s.open, "Necesită urmărire", s.open > 0)}
          {kpiCard(woBase, "În lucru", s.inProgress, "Recepționate / reparație")}
          {kpiCard(
            `${woBase}${woBase.includes("?") ? "&" : "?"}inbox=pending_approval`,
            "Așteaptă aprobare",
            s.pendingApproval,
            "Deviz trimis flotei",
            s.pendingApproval > 0,
          )}
          {kpiCard(woBase, "Așteaptă piese", s.waitingParts, "Status waiting_parts")}
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Programări · facturare
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpiCard(`/fleet/partner/appointments${qs}`, "Programări săptămâna", apptStats?.thisWeek ?? 0, "Calendar furnizor")}
          {kpiCard(
            `${woBase}${woBase.includes("?") ? "&" : "?"}inbox=ready`,
            "Gata, nefacturat",
            s.readyUninvoiced,
            "Upload factură",
            s.readyUninvoiced > 0,
          )}
          {kpiCard(`${woBase}${woBase.includes("?") ? "&" : "?"}inbox=invoiced`, "Facturate", s.done, "Finalizate")}
          {kpiCard(`/fleet/partner/profile${qs}`, "Profil firmă", 1, "Documente & tarife", true)}
        </div>
      </div>

      {stats ? (
        <div className="mt-8">
          <WorkOrderKpiStrip stats={stats} />
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-2">
        <Link href={`/fleet/partner/appointments${qs}`} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900">
          Deschide programator
        </Link>
        <Link href={woBase} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900">
          Toate comenzile
        </Link>
        <Link href={`/fleet/partner/profile${qs}`} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900">
          Profil firmă
        </Link>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-200">Comenzi recente</h2>
          <Link href={woBase} className="text-xs text-violet-400 hover:underline">
            Devize & comenzi →
          </Link>
        </div>
        {!recent?.items.length ? (
          <p className="text-sm text-zinc-500">Nicio comandă deschisă pentru furnizorul dvs.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-900/60 text-[10px] uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Comandă</th>
                  <th className="px-3 py-2">Auto</th>
                  <th className="px-3 py-2">Titlu</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.items.map((row) => (
                  <tr key={row.id} className="border-t border-zinc-800/80">
                    <td className="px-3 py-2">
                      <Link
                        href={`/fleet/partner/work-orders/${row.id}${qs}`}
                        className="font-mono text-xs text-violet-300 hover:underline"
                      >
                        {row.displayNumber ?? row.id.slice(-6).toUpperCase()}
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-400">{row.registrationNumber}</td>
                    <td className="px-3 py-2 text-zinc-300">{row.title}</td>
                    <td className="px-3 py-2 text-xs text-zinc-500">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </FleetPageMain>
  );
}
