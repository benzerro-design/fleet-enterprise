import {
  FleetDataTable,
  fleetTableClass,
  fleetTdClass,
  fleetThClass,
  fleetTheadClass,
} from "@/components/fleet/fleet-data-table";
import { formatRonFromCents } from "@/lib/money";
import type { ClientSubscriptionRow } from "@/lib/clients-api";
import {
  billingCycleLabel,
  planAssignmentStatusClass,
  planAssignmentStatusLabel,
} from "@/lib/pricing-plan-types";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: "numeric" });
}

type Props = {
  subscriptions: ClientSubscriptionRow[];
};

export function ClientSubscriptionTab({ subscriptions }: Props) {
  if (subscriptions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/30 px-6 py-10 text-center">
        <p className="text-sm font-medium text-zinc-300">Niciun plan tarifar aplicat</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
          Planurile tarifare ale clientului vor apărea aici după configurare din{" "}
          <span className="text-zinc-400">Setări → Clienți</span> (superadmin) — funcționalitate planificată.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400">
        Planuri tarifare active sau programate pentru acest client.
      </p>
      <FleetDataTable>
        <table className={fleetTableClass}>
          <thead className={fleetTheadClass}>
            <tr>
              <th className={fleetThClass}>Plan</th>
              <th className={fleetThClass}>Cod</th>
              <th className={fleetThClass}>Ciclu</th>
              <th className={fleetThClass}>Preț</th>
              <th className={fleetThClass}>Valabil de la</th>
              <th className={fleetThClass}>Valabil până</th>
              <th className={fleetThClass}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {subscriptions.map((row) => (
              <tr key={row.assignmentId} className="text-zinc-200">
                <td className={fleetTdClass}>
                  <div>
                    <p className="font-medium text-zinc-100">{row.plan.name}</p>
                    {row.plan.description?.trim() ? (
                      <p className="mt-0.5 text-xs text-zinc-500">{row.plan.description}</p>
                    ) : null}
                    {row.notes?.trim() ? (
                      <p className="mt-1 text-xs text-zinc-500">Notă: {row.notes}</p>
                    ) : null}
                  </div>
                </td>
                <td className={`${fleetTdClass} font-mono text-sm text-zinc-400`}>{row.plan.code}</td>
                <td className={fleetTdClass}>{billingCycleLabel(row.plan.billingCycle)}</td>
                <td className={`${fleetTdClass} font-mono`}>
                  {formatRonFromCents(row.plan.priceCents)} {row.plan.currency}
                </td>
                <td className={`${fleetTdClass} text-zinc-400`}>{formatDate(row.effectiveFrom)}</td>
                <td className={`${fleetTdClass} text-zinc-400`}>{formatDate(row.effectiveTo)}</td>
                <td className={fleetTdClass}>
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${planAssignmentStatusClass(row.status)}`}
                  >
                    {planAssignmentStatusLabel(row.status)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </FleetDataTable>
    </div>
  );
}
