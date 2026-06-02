import Link from "next/link";
import {
  buildDashboardKpiCards,
  formatDashboardMonthLabel,
  type FleetDashboardSnapshot,
} from "@/lib/fleet-dashboard";
import { ReminderActionStatusBadge } from "@/components/fleet/ReminderActionStatusBadge";
import type { ReminderActionSummary } from "@/lib/reminder-actions";

type Props = {
  data: FleetDashboardSnapshot;
};

const toneClasses = {
  neutral: "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700",
  warn: "border-amber-900/60 bg-amber-950/20 hover:border-amber-800/80",
  danger: "border-red-900/60 bg-red-950/20 hover:border-red-800/80",
} as const;

export function FleetDashboardView({ data }: Props) {
  const cards = buildDashboardKpiCards(data);
  const monthLabel = formatDashboardMonthLabel(data.currentMonth.from);

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-xs font-medium uppercase tracking-widest text-zinc-500">Indicatori</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Luna curentă: <span className="text-zinc-300">{monthLabel}</span> — click pe un card pentru lista filtrată.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.key}
              href={card.href}
              className={`block rounded-xl border p-4 transition-colors ${toneClasses[card.tone ?? "neutral"]}`}
            >
              <p className="text-xs font-medium text-zinc-500">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-100">{card.value}</p>
              {card.hint ? <p className="mt-1 text-xs text-zinc-500">{card.hint}</p> : null}
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section id="itp-soon" className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-200">ITP în următoarele 60 zile</h2>
              <p className="mt-1 text-xs text-zinc-500">Vehicule active, sortate după dată ITP.</p>
            </div>
            <Link href={data.links.itpWithin60Days} className="text-xs text-violet-400 hover:text-violet-300">
              Toate vehiculele →
            </Link>
          </div>
          {data.itpSoon.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-500">Niciun ITP în fereastra următoare.</p>
          ) : (
            <ul className="mt-4 divide-y divide-zinc-800">
              {data.itpSoon.map((row) => (
                <li key={row.vehicleId} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                  <div className="min-w-0">
                    <Link
                      href={`/fleet/vehicles/${row.vehicleId}`}
                      className="font-mono text-sm text-zinc-200 hover:text-white"
                    >
                      {row.registrationNumber}
                    </Link>
                    <p className="truncate text-xs text-zinc-500">
                      Client {row.clientId}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm text-zinc-300">
                      {new Date(row.itpExpiresOn).toLocaleDateString("ro-RO")}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {row.daysUntilExpiry === 0
                        ? "azi"
                        : row.daysUntilExpiry === 1
                          ? "în 1 zi"
                          : `în ${row.daysUntilExpiry} zile`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-200">Remindere — necesită acțiune</h2>
              <p className="mt-1 text-xs text-zinc-500">Due azi, curând sau depășite (timp / km).</p>
            </div>
            <Link
              href={data.links.remindersNeedingAction}
              className="text-xs text-violet-400 hover:text-violet-300"
            >
              Toate reminderele →
            </Link>
          </div>
          {data.remindersDue.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-500">Nicio acțiune urgentă în acest moment.</p>
          ) : (
            <ul className="mt-4 divide-y divide-zinc-800">
              {data.remindersDue.map((row) => (
                <li key={row.id} className="flex items-start justify-between gap-3 py-3 first:pt-0">
                  <div className="min-w-0">
                    <Link href={`/fleet/reminders/${row.id}`} className="text-sm font-medium text-zinc-200 hover:text-white">
                      {row.title}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">
                      <Link href={`/fleet/vehicles/${row.vehicleId}`} className="font-mono hover:text-zinc-300">
                        {row.registrationNumber}
                      </Link>
                      {" · "}
                      {row.clientId}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <ReminderActionStatusBadge
                      summary={{ status: row.status } as ReminderActionSummary}
                      compact
                    />
                    {row.dueOn ? (
                      <span className="text-xs text-zinc-500">
                        {new Date(row.dueOn).toLocaleDateString("ro-RO")}
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
