import Link from "next/link";
import {
  buildDashboardKpiCards,
  DASHBOARD_PERIOD_OPTIONS,
  formatDashboardMonthLabel,
  formatRonCompact,
  periodDeltaLabel,
  type FleetDashboardSnapshot,
} from "@/lib/fleet-dashboard";
import { ReminderActionStatusBadge } from "@/components/fleet/ReminderActionStatusBadge";
import type { ReminderActionSummary } from "@/lib/reminder-actions";

type Props = {
  data: FleetDashboardSnapshot;
  canWriteTickets?: boolean;
};

const toneClasses = {
  neutral: "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700",
  warn: "border-amber-900/60 bg-amber-950/20 hover:border-amber-800/80",
  danger: "border-red-900/60 bg-red-950/20 hover:border-red-800/80",
} as const;

const deltaTone = {
  up: "text-emerald-400",
  down: "text-amber-400",
  flat: "text-zinc-500",
} as const;

function periodHref(offset: number): string {
  if (offset === 0) return "/fleet/dashboard";
  return `/fleet/dashboard?monthOffset=${offset}`;
}

export function FleetDashboardView({ data, canWriteTickets }: Props) {
  const cards = buildDashboardKpiCards(data);
  const monthLabel = formatDashboardMonthLabel(data.currentMonth.from);
  const monthOffset = data.monthOffset ?? 0;
  const costsDelta = periodDeltaLabel(
    data.kpis.costsCurrentMonthCents,
    data.kpis.costsPriorMonthCents ?? 0,
  );
  const tripsDelta = periodDeltaLabel(data.kpis.tripsCurrentMonth, data.kpis.tripsPriorMonth ?? 0);

  const quickActions = [
    canWriteTickets
      ? { href: "/fleet/tickets/new", label: "Solicitare nouă", hint: "Tichet CRM" }
      : { href: "/fleet/tickets", label: "Tichete", hint: "Inbox CRM" },
    { href: "/fleet/scheduler", label: "Programator", hint: "Calendar programări" },
    { href: data.links.costsCurrentMonth, label: "Costuri perioadă", hint: monthLabel },
    { href: data.links.tripsCurrentMonth, label: "Curse perioadă", hint: monthLabel },
    { href: data.links.remindersNeedingAction, label: "Remindere acțiune", hint: "Due / curând" },
    { href: "/fleet/vehicles?status=active", label: "Vehicule active", hint: "Flotă" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">Perioadă</span>
        {DASHBOARD_PERIOD_OPTIONS.map((opt) => {
          const active = monthOffset === opt.offset;
          return (
            <Link
              key={opt.offset}
              href={periodHref(opt.offset)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                active
                  ? "bg-emerald-600 text-white"
                  : "border border-zinc-700 text-zinc-300 hover:bg-zinc-900"
              }`}
            >
              {opt.label}
            </Link>
          );
        })}
        <span className="text-xs text-zinc-500">
          Costuri & curse: <span className="text-zinc-300">{monthLabel}</span>
        </span>
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          href={data.links.costsCurrentMonth}
          className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition-colors hover:border-zinc-700"
        >
          <p className="text-xs font-medium text-zinc-500">Costuri · {monthLabel}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-100">
            {formatRonCompact(data.kpis.costsCurrentMonthCents)}
          </p>
          <p className={`mt-1 text-xs ${deltaTone[costsDelta.tone]}`}>{costsDelta.text}</p>
        </Link>
        <Link
          href={data.links.tripsCurrentMonth}
          className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition-colors hover:border-zinc-700"
        >
          <p className="text-xs font-medium text-zinc-500">Curse · {monthLabel}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-100">
            {data.kpis.tripsCurrentMonth}
          </p>
          <p className={`mt-1 text-xs ${deltaTone[tripsDelta.tone]}`}>{tripsDelta.text}</p>
        </Link>
      </section>

      <section>
        <h2 className="text-xs font-medium uppercase tracking-widest text-zinc-500">Indicatori flotă</h2>
        <p className="mt-1 text-sm text-zinc-500">Stare curentă (independent de perioada costuri/curse).</p>
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

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="text-sm font-semibold text-zinc-200">Acțiuni rapide</h2>
          <p className="mt-1 text-xs text-zinc-500">Scurtături operaționale.</p>
          <ul className="mt-4 space-y-1">
            {quickActions.map((a) => (
              <li key={a.href + a.label}>
                <Link
                  href={a.href}
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
                >
                  <span className="font-medium">{a.label}</span>
                  <span className="truncate text-[11px] text-zinc-500">{a.hint}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section id="itp-soon" className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-200">ITP în următoarele 60 zile</h2>
              <p className="mt-1 text-xs text-zinc-500">Vehicule active, sortate după dată ITP.</p>
            </div>
            <Link href={data.links.itpWithin60Days} className="text-xs text-sky-400 hover:text-sky-300">
              Toate →
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
                    <p className="truncate text-xs text-zinc-500">Client {row.clientId}</p>
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
              <h2 className="text-sm font-semibold text-zinc-200">Remindere — acțiune</h2>
              <p className="mt-1 text-xs text-zinc-500">Due azi, curând sau depășite (timp / km).</p>
            </div>
            <Link
              href={data.links.remindersNeedingAction}
              className="text-xs text-sky-400 hover:text-sky-300"
            >
              Toate →
            </Link>
          </div>
          {data.remindersDue.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-500">Nicio acțiune urgentă în acest moment.</p>
          ) : (
            <ul className="mt-4 divide-y divide-zinc-800">
              {data.remindersDue.map((row) => (
                <li key={row.id} className="flex items-start justify-between gap-3 py-3 first:pt-0">
                  <div className="min-w-0">
                    <Link
                      href={`/fleet/reminders/${row.id}`}
                      className="text-sm font-medium text-zinc-200 hover:text-white"
                    >
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
