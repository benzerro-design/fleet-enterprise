import Link from "next/link";
import type { ReactNode } from "react";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { ReminderActionStatusBadge } from "@/components/fleet/ReminderActionStatusBadge";
import { formatDateTimeRo } from "@/lib/datetime-local";
import { FUEL_COST_CATEGORY } from "@/lib/fuel-ops";
import type { VehicleRecord } from "@/lib/fleet-api";
import type { ReminderActionRow } from "@/lib/reminder-actions";
import type { TicketRecord } from "@/lib/tickets-api";

export type DriverHomeTrip = {
  id: string;
  registrationNumber: string;
  startedAt: string;
  originLabel: string | null;
  destLabel: string | null;
};

type Props = {
  driverName?: string;
  vehicles: VehicleRecord[];
  vehiclesLoadFailed: boolean;
  trips: DriverHomeTrip[];
  reminders: ReminderActionRow[];
  tickets: TicketRecord[];
};

function formatKm(n: number): string {
  return `${n.toLocaleString("ro-RO")} km`;
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - start.getTime()) / 86_400_000);
}

const actionBtn =
  "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium";
const actionPrimary = `${actionBtn} bg-emerald-500 text-zinc-950 hover:bg-emerald-400`;
const actionOutline = `${actionBtn} border border-zinc-700 bg-zinc-900/40 text-zinc-200 hover:bg-zinc-900`;

function Section({
  title,
  href,
  hrefLabel,
  children,
}: {
  title: string;
  href: string;
  hrefLabel: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
        <Link href={href} className="text-xs text-emerald-400 hover:text-emerald-300">
          {hrefLabel}
        </Link>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function DriverHomeView({
  driverName,
  vehicles,
  vehiclesLoadFailed,
  trips,
  reminders,
  tickets,
  }: Props) {
  const primary = vehicles[0];
  const fuelHref = primary
    ? `/fleet/costs/new?category=${encodeURIComponent(FUEL_COST_CATEGORY)}&vehicleId=${encodeURIComponent(primary.id)}`
    : `/fleet/costs/new?category=${encodeURIComponent(FUEL_COST_CATEGORY)}`;
  const tripHref = primary ? `/fleet/trips/new?vehicleId=${encodeURIComponent(primary.id)}` : "/fleet/trips/new";
  const ticketHref = primary ? `/fleet/tickets/new?vehicleId=${encodeURIComponent(primary.id)}` : "/fleet/tickets/new";

  return (
    <FleetPageMain>
      <div className="mb-2">
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Cont șofer</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {driverName ? `Salut, ${driverName}` : "Acasă"}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-zinc-400">
          Mașina alocată, termene, curse deschise și tichetele tale — fără lista de administrare flotă.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={tripHref} className={actionPrimary}>
          Cursă nouă
        </Link>
        <Link href={fuelHref} className={actionOutline}>
          Alimentare
        </Link>
        <Link href={ticketHref} className={actionOutline}>
          Tichet nou
        </Link>
      </div>

      <section>
        <h2 className="text-xs font-medium uppercase tracking-widest text-zinc-500">Vehicule alocate</h2>
        {vehiclesLoadFailed ? (
          <p className="mt-4 text-sm text-amber-400">Nu am putut încărca vehiculele. Reîncearcă după reîmprospătare.</p>
        ) : vehicles.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">
            Nu ai vehicule alocate. Cere managerului să te pună pe o mașină.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {vehicles.map((v) => {
              const days = daysUntil(v.itpExpiresOn);
              const itpWarn = days != null && days <= 30;
              return (
                <li key={v.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-lg text-zinc-100">{v.registrationNumber}</p>
                      <p className="mt-1 truncate text-sm text-zinc-400">
                        {[v.brand, v.model].filter(Boolean).join(" ") || v.type}
                      </p>
                    </div>
                    <Link
                      href={`/fleet/vehicles/${v.id}`}
                      className="shrink-0 text-sm text-emerald-400 hover:text-emerald-300"
                    >
                      Detaliu
                    </Link>
                  </div>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-zinc-100">{formatKm(v.odometerKm)}</p>
                  <p className={`mt-1 text-xs ${itpWarn ? "text-amber-300" : "text-zinc-500"}`}>
                    ITP{" "}
                    {v.itpExpiresOn
                      ? `${new Date(v.itpExpiresOn).toLocaleDateString("ro-RO")}${
                          days != null ? ` · ${days < 0 ? `depășit ${Math.abs(days)}z` : `${days}z`}` : ""
                        }`
                      : "—"}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/fleet/trips/new?vehicleId=${encodeURIComponent(v.id)}`}
                      className="text-xs text-emerald-400 hover:underline"
                    >
                      Cursă
                    </Link>
                    <Link
                      href={`/fleet/costs/new?category=${encodeURIComponent(FUEL_COST_CATEGORY)}&vehicleId=${encodeURIComponent(v.id)}`}
                      className="text-xs text-emerald-400 hover:underline"
                    >
                      Alimentare
                    </Link>
                    <Link
                      href={`/fleet/tickets/new?vehicleId=${encodeURIComponent(v.id)}`}
                      className="text-xs text-emerald-400 hover:underline"
                    >
                      Tichet
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="Remindere de acțiune" href="/fleet/reminders?status=action" hrefLabel="Toate →">
          {reminders.length === 0 ? (
            <p className="text-sm text-zinc-500">Nimic de făcut acum.</p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {reminders.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                  <div className="min-w-0">
                    <Link href={`/fleet/reminders/${r.id}`} className="truncate text-sm text-zinc-200 hover:text-white">
                      {r.title}
                    </Link>
                    <p className="font-mono text-xs text-zinc-500">{r.registrationNumber}</p>
                  </div>
                  <ReminderActionStatusBadge summary={r.summary} />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Curse deschise" href="/fleet/trips?ended=open" hrefLabel="Toate →">
          {trips.length === 0 ? (
            <p className="text-sm text-zinc-500">Nicio cursă deschisă.</p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {trips.map((t) => (
                <li key={t.id} className="py-2.5 first:pt-0">
                  <Link href={`/fleet/trips/${t.id}`} className="text-sm text-zinc-200 hover:text-white">
                    {t.registrationNumber}
                    {t.originLabel || t.destLabel
                      ? ` · ${t.originLabel ?? "?"} → ${t.destLabel ?? "?"}`
                      : ""}
                  </Link>
                  <p className="text-xs text-zinc-500">{formatDateTimeRo(t.startedAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Tichetele tale" href="/fleet/tickets" hrefLabel="Toate →">
          {tickets.length === 0 ? (
            <p className="text-sm text-zinc-500">Niciun tichet deschis.</p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {tickets.map((t) => (
                <li key={t.id} className="py-2.5 first:pt-0">
                  <Link href={`/fleet/tickets/${t.id}`} className="text-sm text-zinc-200 hover:text-white">
                    {t.displayId} · {t.subject}
                  </Link>
                  <p className="text-xs text-zinc-500">
                    {t.registrationNumber ?? "Fără vehicul"} · {t.status}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </FleetPageMain>
  );
}
