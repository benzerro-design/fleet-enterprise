import Link from "next/link";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { appendPartnerSupplierQuery } from "@/lib/partner-context";
import type { PartnerAdminOverview } from "@/lib/partner-api";

type Props = {
  overview: PartnerAdminOverview;
};

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

export function PartnerAdminOverview({ overview }: Props) {
  const t = overview.totals;

  return (
    <FleetPageMain>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-500">
          Portal furnizori · admin
        </p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-100">Overview furnizori</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {t.supplierCount} furnizori activi · selectați un rând pentru view-as
        </p>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCard("/fleet/partner/work-orders?inbox=open", "WO deschise", t.open, "Cross-supplier", t.open > 0)}
        {kpiCard(
          "/fleet/partner/work-orders?inbox=pending_approval",
          "Devize pending",
          t.pendingApproval,
          "Așteaptă aprobare",
          t.pendingApproval > 0,
        )}
        {kpiCard(
          "/fleet/partner/work-orders?inbox=ready",
          "Gata nefacturat",
          t.readyUninvoiced,
          "Upload factură",
          t.readyUninvoiced > 0,
        )}
        {kpiCard("/fleet/partner/appointments", "Programări săpt.", t.appointmentsThisWeek, "Calendar")}
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-zinc-200">Per furnizor</h2>
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900/60 text-[10px] uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2">Furnizor</th>
                <th className="px-3 py-2">Deschise</th>
                <th className="px-3 py-2">Devize</th>
                <th className="px-3 py-2">Nefacturat</th>
                <th className="px-3 py-2">Prog. săpt.</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {overview.suppliers.map((row) => (
                <tr key={row.id} className="border-t border-zinc-800/80">
                  <td className="px-3 py-2">
                    <p className="font-mono text-xs text-violet-300">{row.code}</p>
                    <p className="text-zinc-300">{row.legalName}</p>
                  </td>
                  <td className="px-3 py-2 text-zinc-300">{row.open}</td>
                  <td className="px-3 py-2 text-zinc-300">{row.pendingApproval}</td>
                  <td className="px-3 py-2 text-zinc-300">{row.readyUninvoiced}</td>
                  <td className="px-3 py-2 text-zinc-300">{row.appointmentsThisWeek}</td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={appendPartnerSupplierQuery("/fleet/partner", { supplierId: row.id })}
                      className="text-xs text-violet-400 hover:underline"
                    >
                      View as →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </FleetPageMain>
  );
}
