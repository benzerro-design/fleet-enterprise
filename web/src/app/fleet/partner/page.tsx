import Link from "next/link";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { WorkOrderKpiStrip } from "@/components/fleet/work-orders/WorkOrderKpiStrip";
import { getAuthMeResult } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";
import { primarySupplierMembership } from "@/lib/partner-auth";
import type { AppointmentStats } from "@/lib/appointments-api";
import type { WorkOrderListPayload, WorkOrderStats } from "@/lib/work-orders-api";

async function loadStats(): Promise<WorkOrderStats | null> {
  try {
    const res = await fleetServerFetch("/work-orders/stats");
    if (!res?.ok) return null;
    return (await res.json()) as WorkOrderStats;
  } catch {
    return null;
  }
}

async function loadAppointmentStats(): Promise<AppointmentStats | null> {
  try {
    const res = await fleetServerFetch("/appointments/stats");
    if (!res?.ok) return null;
    return (await res.json()) as AppointmentStats;
  } catch {
    return null;
  }
}

async function loadRecentOrders(): Promise<WorkOrderListPayload | null> {
  try {
    const res = await fleetServerFetch("/work-orders?inbox=open&pageSize=6");
    if (!res?.ok) return null;
    return (await res.json()) as WorkOrderListPayload;
  } catch {
    return null;
  }
}

function kpiCard(href: string, label: string, value: number, sub: string, warn?: boolean) {
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

export default async function PartnerDashboardPage() {
  const [auth, stats, apptStats, recent] = await Promise.all([
    getAuthMeResult(),
    loadStats(),
    loadAppointmentStats(),
    loadRecentOrders(),
  ]);
  const supplier = auth.ok ? primarySupplierMembership(auth.me) : undefined;
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
          {kpiCard("/fleet/partner/work-orders?inbox=open", "Deschise", s.open, "Necesită urmărire", s.open > 0)}
          {kpiCard("/fleet/partner/work-orders", "În lucru", s.inProgress, "Recepționate / reparație")}
          {kpiCard(
            "/fleet/partner/work-orders?inbox=pending_approval",
            "Așteaptă aprobare",
            s.pendingApproval,
            "Deviz trimis flotei",
            s.pendingApproval > 0,
          )}
          {kpiCard("/fleet/partner/work-orders", "Așteaptă piese", s.waitingParts, "Status waiting_parts")}
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Programări · facturare
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpiCard(
            "/fleet/partner/appointments",
            "Programări săptămâna",
            apptStats?.thisWeek ?? 0,
            "Calendar furnizor",
          )}
          {kpiCard(
            "/fleet/partner/work-orders?inbox=ready",
            "Gata, nefacturat",
            s.readyUninvoiced,
            "Upload factură",
            s.readyUninvoiced > 0,
          )}
          {kpiCard("/fleet/partner/work-orders?inbox=invoiced", "Facturate", s.done, "Finalizate")}
          {kpiCard("/fleet/partner/profile", "Profil firmă", 1, "Documente & tarife", true)}
        </div>
      </div>

      {stats ? (
        <div className="mt-8">
          <WorkOrderKpiStrip stats={stats} />
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-2">
        <Link
          href="/fleet/partner/appointments"
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900"
        >
          Deschide programator
        </Link>
        <Link
          href="/fleet/partner/work-orders"
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900"
        >
          Toate comenzile
        </Link>
        <Link
          href="/fleet/partner/profile"
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900"
        >
          Profil firmă
        </Link>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-200">Comenzi recente</h2>
          <Link href="/fleet/partner/work-orders" className="text-xs text-violet-400 hover:underline">
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
                        href={`/fleet/partner/work-orders/${row.id}`}
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
