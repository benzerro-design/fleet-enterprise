"use client";

import Link from "next/link";
import { useState } from "react";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
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
  driverPhotoUrl?: string | null;
  selectedVehicleId?: string;
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return letters || "?";
}

function DriverPortrait({ name, photoUrl }: { name: string; photoUrl?: string | null }) {
  const [failed, setFailed] = useState(false);
  const src = photoUrl?.trim() || null;
  if (!src || failed) {
    return (
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-base font-medium text-zinc-100 ring-1 ring-zinc-700">
        {initials(name)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      onError={() => setFailed(true)}
      className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-zinc-700"
    />
  );
}

function VehicleHero({ vehicle }: { vehicle: VehicleRecord }) {
  const [failed, setFailed] = useState(false);
  const src = vehicle.heroPhotoUrl?.trim() || null;
  const label = [vehicle.brand, vehicle.model, vehicle.registrationNumber].filter(Boolean).join(" ");
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-zinc-800">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={label}
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full items-end p-5">
          <span className="font-mono text-3xl tracking-tight text-zinc-200">{vehicle.registrationNumber}</span>
        </div>
      )}
    </div>
  );
}

export function DriverHomeView({
  driverName,
  driverPhotoUrl,
  selectedVehicleId,
  vehicles,
  vehiclesLoadFailed,
  trips,
  reminders,
  tickets,
}: Props) {
  const tx = useT();
  const displayName = driverName?.trim() || tx("driver.home.home");
  const selected = vehicles.find((v) => v.id === selectedVehicleId) ?? vehicles[0] ?? null;
  const openTrip =
    trips.find((trip) => selected && trip.registrationNumber === selected.registrationNumber) ?? trips[0] ?? null;
  const fuelHref = selected
    ? `/fleet/costs/new?category=${encodeURIComponent(FUEL_COST_CATEGORY)}&vehicleId=${encodeURIComponent(selected.id)}`
    : `/fleet/costs/new?category=${encodeURIComponent(FUEL_COST_CATEGORY)}`;
  const startHref = selected ? `/fleet/trips/new?vehicleId=${encodeURIComponent(selected.id)}` : "/fleet/trips/new";
  const ticketHref = selected
    ? `/fleet/tickets/new?vehicleId=${encodeURIComponent(selected.id)}`
    : "/fleet/tickets/new";
  const primaryHref = openTrip ? `/fleet/trips/${openTrip.id}` : startHref;
  const model = selected ? [selected.brand, selected.model].filter(Boolean).join(" ") : "";
  const itpDays = selected ? daysUntil(selected.itpExpiresOn) : null;
  const itpWarn = itpDays != null && itpDays <= 30;

  const attention: Array<{ href: string; label: string }> = [];
  if (selected && itpWarn && selected.itpExpiresOn) {
    const when =
      itpDays != null && itpDays < 0
        ? tx("driver.home.itpOverdue").replace("{days}", String(Math.abs(itpDays)))
        : tx("driver.home.itpRemaining").replace("{days}", String(itpDays ?? 0));
    attention.push({
      href: `/fleet/vehicles/${selected.id}`,
      label: `${tx("driver.home.itp")} · ${new Date(selected.itpExpiresOn).toLocaleDateString("ro-RO")} · ${when}`,
    });
  }
  for (const reminder of reminders.slice(0, 2)) {
    attention.push({ href: `/fleet/reminders/${reminder.id}`, label: reminder.title });
  }
  for (const ticket of tickets.slice(0, 2)) {
    attention.push({ href: `/fleet/tickets/${ticket.id}`, label: `${ticket.displayId} · ${ticket.subject}` });
  }

  return (
    <FleetPageMain>
      <header className="flex items-center gap-3">
        <DriverPortrait name={displayName} photoUrl={driverPhotoUrl} />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">
            {driverName ? tx("driver.home.greeting").replace("{name}", driverName) : tx("driver.home.home")}
          </h1>
          <p className="truncate text-sm text-zinc-400">
            {selected
              ? `${selected.registrationNumber} · ${openTrip ? tx("driver.home.onTrip") : tx("driver.home.noOpenTrip")}`
              : tx("driver.home.noVehicle")}
          </p>
        </div>
      </header>

      {vehiclesLoadFailed ? <p className="text-sm text-amber-400">{tx("driver.home.vehiclesLoadFailed")}</p> : null}

      {!vehiclesLoadFailed && vehicles.length === 0 ? (
        <p className="text-sm text-zinc-500">{tx("driver.home.noVehicles")}</p>
      ) : null}

      {selected ? (
        <section className="space-y-4">
          {vehicles.length > 1 ? (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
              {vehicles.map((vehicle) => {
                const active = vehicle.id === selected.id;
                return (
                  <Link
                    key={vehicle.id}
                    href={`/fleet/vehicles?vehicleId=${encodeURIComponent(vehicle.id)}`}
                    className={`inline-flex min-h-[44px] shrink-0 items-center rounded-full px-4 font-mono text-sm ${
                      active ? "bg-zinc-100 text-zinc-950" : "bg-zinc-900 text-zinc-300 ring-1 ring-zinc-800"
                    }`}
                  >
                    {vehicle.registrationNumber}
                  </Link>
                );
              })}
            </div>
          ) : null}

          <VehicleHero vehicle={selected} />

          <div>
            <p className="font-mono text-3xl tracking-tight text-zinc-50">{selected.registrationNumber}</p>
            <p className="mt-1 text-sm text-zinc-400">
              {model || selected.type}
              {" · "}
              {formatKm(selected.odometerKm)}
              {selected.itpExpiresOn
                ? ` · ${tx("driver.home.itp")} ${new Date(selected.itpExpiresOn).toLocaleDateString("ro-RO")}`
                : ""}
            </p>
          </div>

          {openTrip ? (
            <Link href={`/fleet/trips/${openTrip.id}`} className="block text-sm text-zinc-300">
              <span className="text-zinc-500">{formatDateTimeRo(openTrip.startedAt)}</span>
              {openTrip.originLabel || openTrip.destLabel
                ? ` · ${openTrip.originLabel ?? "?"} → ${openTrip.destLabel ?? "?"}`
                : ""}
            </Link>
          ) : null}

          <Link
            href={primaryHref}
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-emerald-500 text-base font-medium text-zinc-950"
          >
            {openTrip ? tx("driver.home.closeTrip") : tx("driver.home.startTrip")}
          </Link>

          <div className="grid grid-cols-2 gap-2">
            <Link
              href={fuelHref}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl text-sm text-zinc-200 ring-1 ring-zinc-800"
            >
              {tx("driver.home.fuel")}
            </Link>
            <Link
              href={ticketHref}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl text-sm text-zinc-200 ring-1 ring-zinc-800"
            >
              {tx("driver.home.newTicket")}
            </Link>
          </div>
        </section>
      ) : null}

      {attention.length > 0 ? (
        <section>
          <h2 className="text-xs font-medium uppercase tracking-widest text-zinc-500">{tx("driver.home.attention")}</h2>
          <ul className="mt-2">
            {attention.map((item) => (
              <li key={item.href + item.label} className="border-b border-zinc-800/80">
                <Link href={item.href} className="block truncate py-3 text-sm text-zinc-200">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </FleetPageMain>
  );
}
