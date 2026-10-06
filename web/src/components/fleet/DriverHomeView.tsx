"use client";

import Link from "next/link";
import { useState } from "react";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { VehicleVisual } from "@/components/fleet/VehicleVisual";
import { formatDateTimeRo } from "@/lib/datetime-local";
import { FUEL_COST_CATEGORY } from "@/lib/fuel-ops";
import { fuelCardStatusLabel } from "@/lib/fuel-card-providers";
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

export type DriverAttentionItem = {
  id: string;
  href: string;
  label: string;
  tone?: "default" | "amber";
};

type Props = {
  driverName?: string;
  driverPhotoUrl?: string | null;
  vehicle: VehicleRecord | null;
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

function DriverAvatar({
  name,
  photoUrl,
  size = "welcome",
}: {
  name: string;
  photoUrl?: string | null;
  size?: "welcome" | "top";
}) {
  const [failed, setFailed] = useState(false);
  const src = photoUrl?.trim() || null;
  const dim = size === "welcome" ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs";
  if (!src || failed) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center rounded-full bg-zinc-800 font-medium text-zinc-100 ring-1 ring-zinc-700 ${dim}`}
      >
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
      className={`shrink-0 rounded-full object-cover ring-1 ring-zinc-700 ${dim}`}
    />
  );
}

const primaryBtn =
  "inline-flex h-11 items-center justify-center rounded-full bg-emerald-500 px-5 text-sm font-medium text-zinc-950 hover:bg-emerald-400 lg:h-10";
const quietBtn =
  "inline-flex h-10 items-center rounded-full px-3 text-sm font-medium text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100";

/** Signal list — rows can include tracking later without layout changes. */
export function DriverAttentionList({ title, items }: { title: string; items: DriverAttentionItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="min-w-0">
      <h2 className="text-xs font-medium uppercase tracking-widest text-zinc-500">{title}</h2>
      <ul className="mt-2 divide-y divide-zinc-800/80 rounded-xl ring-1 ring-zinc-800/60">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className={`flex min-h-[44px] items-center gap-2 px-3 py-2.5 text-sm ${
                item.tone === "amber" ? "text-amber-200" : "text-zinc-200"
              } hover:bg-zinc-900/50`}
            >
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <span className="shrink-0 text-zinc-600" aria-hidden>
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function VehicleStatusBlock({ vehicle }: { vehicle: VehicleRecord }) {
  const tx = useT();
  const itpDays = daysUntil(vehicle.itpExpiresOn);
  const itpWarn = itpDays != null && itpDays <= 30;
  const showFuelCard = Boolean(vehicle.fuelCardProvider?.trim() || vehicle.fuelCardNumber?.trim());

  return (
    <dl className="space-y-2 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <dt className="text-zinc-500">{tx("driver.home.itp")}</dt>
        <dd className={itpWarn ? "text-amber-300" : "text-zinc-200"}>
          {vehicle.itpExpiresOn
            ? new Date(vehicle.itpExpiresOn).toLocaleDateString("ro-RO")
            : "—"}
          {itpDays != null && vehicle.itpExpiresOn ? (
            <span className="ml-2 text-zinc-500">
              {itpDays < 0
                ? tx("driver.home.itpOverdue").replace("{days}", String(Math.abs(itpDays)))
                : tx("driver.home.itpRemaining").replace("{days}", String(itpDays))}
            </span>
          ) : null}
        </dd>
      </div>
      {showFuelCard ? (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <dt className="text-zinc-500">{tx("driver.home.fuelCard")}</dt>
          <dd className="text-zinc-200">
            {[vehicle.fuelCardProvider, fuelCardStatusLabel(vehicle.fuelCardStatus)]
              .filter(Boolean)
              .join(" · ") || "—"}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

export function DriverHomeView({
  driverName,
  driverPhotoUrl,
  vehicle,
  vehiclesLoadFailed,
  trips,
  reminders,
  tickets,
}: Props) {
  const tx = useT();
  const displayName = driverName?.trim() || tx("driver.home.home");
  const openTrip =
    trips.find((trip) => vehicle && trip.registrationNumber === vehicle.registrationNumber) ??
    trips[0] ??
    null;
  const fuelHref = vehicle
    ? `/fleet/costs/new?category=${encodeURIComponent(FUEL_COST_CATEGORY)}&vehicleId=${encodeURIComponent(vehicle.id)}`
    : `/fleet/costs/new?category=${encodeURIComponent(FUEL_COST_CATEGORY)}`;
  const startHref = vehicle ? `/fleet/trips/new?vehicleId=${encodeURIComponent(vehicle.id)}` : "/fleet/trips/new";
  const ticketHref = vehicle
    ? `/fleet/tickets/new?vehicleId=${encodeURIComponent(vehicle.id)}`
    : "/fleet/tickets/new";
  const primaryHref = openTrip ? `/fleet/trips/${openTrip.id}` : startHref;
  const model = vehicle ? [vehicle.brand, vehicle.model].filter(Boolean).join(" ") : "";
  const itpDays = vehicle ? daysUntil(vehicle.itpExpiresOn) : null;
  const itpWarn = itpDays != null && itpDays <= 30;

  const attention: DriverAttentionItem[] = [];
  if (vehicle && itpWarn && vehicle.itpExpiresOn) {
    const when =
      itpDays != null && itpDays < 0
        ? tx("driver.home.itpOverdue").replace("{days}", String(Math.abs(itpDays)))
        : tx("driver.home.itpRemaining").replace("{days}", String(itpDays ?? 0));
    attention.push({
      id: "itp",
      href: `/fleet/vehicles/${vehicle.id}`,
      label: `${tx("driver.home.itp")} · ${new Date(vehicle.itpExpiresOn).toLocaleDateString("ro-RO")} · ${when}`,
      tone: "amber",
    });
  }
  for (const reminder of reminders.slice(0, 4)) {
    attention.push({ id: `rem-${reminder.id}`, href: `/fleet/reminders/${reminder.id}`, label: reminder.title });
  }
  for (const ticket of tickets.slice(0, 4)) {
    attention.push({
      id: `tkt-${ticket.id}`,
      href: `/fleet/tickets/${ticket.id}`,
      label: `${ticket.displayId} · ${ticket.subject}`,
    });
  }

  const vehicleCard = vehicle ? (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <VehicleVisual
          photoUrl={vehicle.heroPhotoUrl}
          alt={vehicle.registrationNumber}
          size="lg"
          className="mx-auto sm:mx-0 lg:hidden"
        />
        <VehicleVisual
          photoUrl={vehicle.heroPhotoUrl}
          alt={vehicle.registrationNumber}
          size="xl"
          className="mx-auto hidden sm:mx-0 lg:block"
        />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-2xl tracking-tight text-zinc-50 lg:text-3xl">{vehicle.registrationNumber}</p>
          <p className="mt-1 text-sm text-zinc-400">
            {model || vehicle.type}
            {" · "}
            {formatKm(vehicle.odometerKm)}
          </p>
          {openTrip ? (
            <Link href={`/fleet/trips/${openTrip.id}`} className="mt-2 block text-sm text-zinc-300 hover:text-zinc-100">
              <span className="text-zinc-500">{formatDateTimeRo(openTrip.startedAt)}</span>
              {openTrip.originLabel || openTrip.destLabel
                ? ` · ${openTrip.originLabel ?? "?"} → ${openTrip.destLabel ?? "?"}`
                : ""}
            </Link>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">{tx("driver.home.noOpenTrip")}</p>
          )}
        </div>
      </div>

      <div className="mt-5 border-t border-zinc-800/80 pt-4">
        <VehicleStatusBlock vehicle={vehicle} />
      </div>

      <div className="mt-5 flex flex-col items-start gap-3">
        <Link href={primaryHref} className={primaryBtn}>
          {openTrip ? tx("driver.home.closeTrip") : tx("driver.home.startTrip")}
        </Link>
        <div className="flex flex-wrap items-center gap-1">
          <Link href={fuelHref} className={quietBtn}>
            {tx("driver.home.fuel")}
          </Link>
          <span className="text-zinc-700" aria-hidden>
            ·
          </span>
          <Link href={ticketHref} className={quietBtn}>
            {tx("driver.home.newTicket")}
          </Link>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <FleetPageMain className="mx-auto w-full max-w-5xl">
      <header className="flex items-center gap-3">
        <DriverAvatar name={displayName} photoUrl={driverPhotoUrl} size="welcome" />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight lg:text-2xl">
            {driverName ? tx("driver.home.greeting").replace("{name}", driverName) : tx("driver.home.home")}
          </h1>
          <p className="truncate text-sm text-zinc-400">
            {vehicle
              ? `${vehicle.registrationNumber} · ${openTrip ? tx("driver.home.onTrip") : tx("driver.home.noOpenTrip")}`
              : tx("driver.home.noVehicle")}
          </p>
        </div>
      </header>

      {vehiclesLoadFailed ? <p className="text-sm text-amber-400">{tx("driver.home.vehiclesLoadFailed")}</p> : null}

      {!vehiclesLoadFailed && !vehicle ? (
        <p className="text-sm text-zinc-500">{tx("driver.home.noVehicles")}</p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start lg:gap-8">
        {vehicleCard}
        <DriverAttentionList title={tx("driver.home.attention")} items={attention} />
      </div>
    </FleetPageMain>
  );
}
