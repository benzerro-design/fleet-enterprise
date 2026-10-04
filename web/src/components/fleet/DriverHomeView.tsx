"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { ReminderActionStatusBadge } from "@/components/fleet/ReminderActionStatusBadge";
import { VehicleVisual } from "@/components/fleet/VehicleVisual";
import { formatDateTimeRo } from "@/lib/datetime-local";
import { FUEL_COST_CATEGORY } from "@/lib/fuel-ops";
import type { VehicleRecord } from "@/lib/fleet-api";
import { useT } from "@/lib/i18n/useT";
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
  "inline-flex min-h-[44px] w-full touch-manipulation items-center justify-center rounded-lg px-4 py-3 text-sm font-medium sm:w-auto";
const actionPrimary = `${actionBtn} bg-emerald-500 text-zinc-950 hover:bg-emerald-400`;
const actionOutline = `${actionBtn} border border-zinc-700 bg-zinc-900/40 text-zinc-200 hover:bg-zinc-900`;
const quickVehicleAction =
  "inline-flex min-h-[44px] flex-1 touch-manipulation items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-zinc-900 sm:flex-none";

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
  const tx = useT();
  const primary = vehicles[0];
  const fuelHref = primary
    ? `/fleet/costs/new?category=${encodeURIComponent(FUEL_COST_CATEGORY)}&vehicleId=${encodeURIComponent(primary.id)}`
    : `/fleet/costs/new?category=${encodeURIComponent(FUEL_COST_CATEGORY)}`;
  const tripHref = primary ? `/fleet/trips/new?vehicleId=${encodeURIComponent(primary.id)}` : "/fleet/trips/new";
  const ticketHref = primary ? `/fleet/tickets/new?vehicleId=${encodeURIComponent(primary.id)}` : "/fleet/tickets/new";

  return (
    <FleetPageMain>
      <div className="mb-2">
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">{tx("driver.home.account")}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          {driverName ? tx("driver.home.greeting").replace("{name}", driverName) : tx("driver.home.home")}
        </h1>
        <p className="mt-3 hidden max-w-2xl text-sm text-zinc-400 sm:block">
          {tx("driver.home.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
        <Link href={tripHref} className={actionPrimary}>
          {tx("driver.home.newTrip")}
        </Link>
        <Link href={fuelHref} className={actionOutline}>
          {tx("driver.home.fuel")}
        </Link>
        <Link href={ticketHref} className={actionOutline}>
          {tx("driver.home.newTicket")}
        </Link>
      </div>

      <section>
        <h2 className="text-xs font-medium uppercase tracking-widest text-zinc-500">{tx("driver.home.allocatedVehicles")}</h2>
        {vehiclesLoadFailed ? (
          <p className="mt-4 text-sm text-amber-400">{tx("driver.home.vehiclesLoadFailed")}</p>
        ) : vehicles.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">
            {tx("driver.home.noVehicles")}
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {vehicles.map((v) => {
              const days = daysUntil(v.itpExpiresOn);
              const itpWarn = days != null && days <= 30;
              return (
                <li key={v.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      {v.heroPhotoUrl ? (
                        <VehicleVisual photoUrl={v.heroPhotoUrl} alt={v.registrationNumber} size="md" />
                      ) : null}
                      <div className="min-w-0">
                        <p className="font-mono text-lg text-zinc-100">{v.registrationNumber}</p>
                        <p className="mt-1 truncate text-sm text-zinc-400">
                          {[v.brand, v.model].filter(Boolean).join(" ") || v.type}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/fleet/vehicles/${v.id}`}
                      className="shrink-0 text-sm text-emerald-400 hover:text-emerald-300"
                    >
                      {tx("driver.home.detail")}
                    </Link>
                  </div>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-zinc-100">{formatKm(v.odometerKm)}</p>
                  <p className={`mt-1 text-xs ${itpWarn ? "text-amber-300" : "text-zinc-500"}`}>
                    {tx("driver.home.itp")}{" "}
                    {v.itpExpiresOn
                      ? `${new Date(v.itpExpiresOn).toLocaleDateString("ro-RO")}${
                          days != null
                            ? ` · ${
                                days < 0
                                  ? tx("driver.home.itpOverdue").replace("{days}", String(Math.abs(days)))
                                  : tx("driver.home.itpRemaining").replace("{days}", String(days))
                              }`
                            : ""
                        }`
                      : "—"}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/fleet/trips/new?vehicleId=${encodeURIComponent(v.id)}`}
                      className={quickVehicleAction}
                    >
                      {tx("driver.home.trip")}
                    </Link>
                    <Link
                      href={`/fleet/costs/new?category=${encodeURIComponent(FUEL_COST_CATEGORY)}&vehicleId=${encodeURIComponent(v.id)}`}
                      className={quickVehicleAction}
                    >
                      {tx("driver.home.fuel")}
                    </Link>
                    <Link
                      href={`/fleet/tickets/new?vehicleId=${encodeURIComponent(v.id)}`}
                      className={quickVehicleAction}
                    >
                      {tx("driver.home.ticket")}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title={tx("driver.home.actionReminders")} href="/fleet/reminders?status=action" hrefLabel={tx("driver.home.viewAll")}>
          {reminders.length === 0 ? (
            <p className="text-sm text-zinc-500">{tx("driver.home.emptyReminders")}</p>
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

        <Section title={tx("driver.home.trips")} href="/fleet/trips?ended=open" hrefLabel={tx("driver.home.viewAll")}>
          {trips.length === 0 ? (
            <p className="text-sm text-zinc-500">{tx("driver.home.emptyTrips")}</p>
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

        <Section title={tx("driver.home.tickets")} href="/fleet/tickets" hrefLabel={tx("driver.home.viewAll")}>
          {tickets.length === 0 ? (
            <p className="text-sm text-zinc-500">{tx("driver.home.emptyTickets")}</p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {tickets.map((t) => (
                <li key={t.id} className="py-2.5 first:pt-0">
                  <Link href={`/fleet/tickets/${t.id}`} className="text-sm text-zinc-200 hover:text-white">
                    {t.displayId} · {t.subject}
                  </Link>
                  <p className="text-xs text-zinc-500">
                    {t.registrationNumber ?? tx("driver.home.noVehicle")} · {t.status}
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
