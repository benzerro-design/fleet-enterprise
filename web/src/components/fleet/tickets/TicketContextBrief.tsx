"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FleetAvatar } from "@/components/fleet/tickets/TicketListGlyphs";
import { TicketStatusBadge } from "@/components/fleet/TicketStatusBadge";
import type { OpsVehicleOption } from "@/lib/ops-form-context";
import { ticketsBrowserBase, type TicketRecord } from "@/lib/tickets-api";

type Props = {
  clientId: string;
  vehicleId: string;
  driverId: string;
  vehicles: OpsVehicleOption[];
  reminderActionId?: string;
  onVehicleIdChange: (id: string) => void;
  vehicleLocked?: boolean;
};

function BriefSection({
  title,
  count,
  children,
  defaultOpen = false,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-zinc-300 hover:bg-zinc-900/50"
      >
        <span>{title}</span>
        <span className="flex items-center gap-2 text-zinc-500">
          {count != null ? <span className="font-mono text-[10px]">{count}</span> : null}
          <span className={`transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
        </span>
      </button>
      {open ? <div className="border-t border-zinc-800 px-3 py-2">{children}</div> : null}
    </div>
  );
}

export function TicketContextBrief({
  clientId,
  vehicleId,
  driverId,
  vehicles,
  reminderActionId,
  onVehicleIdChange,
  vehicleLocked = false,
}: Props) {
  const [vehicleTickets, setVehicleTickets] = useState<TicketRecord[]>([]);
  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);

  useEffect(() => {
    if (!vehicleId.trim()) {
      setVehicleTickets([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${ticketsBrowserBase}?vehicleId=${encodeURIComponent(vehicleId)}&pageSize=5`);
        if (!res.ok) return;
        const data = (await res.json()) as { items: TicketRecord[] };
        if (!cancelled) {
          setVehicleTickets(
            data.items.filter((t) => t.status === "open" || t.status === "in_progress").slice(0, 5),
          );
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  const vehicleOptions = clientId.trim()
    ? vehicles.filter((v) => v.clientId.toLowerCase() === clientId.trim().toLowerCase())
    : vehicles;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Context solicitare</p>
        <p className="mt-1 text-sm text-zinc-400">Vehicul, șofer și tichete deschise</p>
      </div>

      <div>
        <label className="text-xs text-zinc-500">Vehicul</label>
        <select
          value={vehicleId}
          onChange={(e) => onVehicleIdChange(e.target.value)}
          disabled={vehicleLocked}
          className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        >
          <option value="">—</option>
          {vehicleOptions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.registrationNumber}
            </option>
          ))}
        </select>
        {selectedVehicle ? (
          <p className="mt-1 font-mono text-xs text-sky-300">
            {(selectedVehicle.odometerKm ?? 0).toLocaleString("ro-RO")} km
          </p>
        ) : null}
      </div>

      {driverId ? (
        <p className="text-xs text-zinc-500">Șofer selectat în formular</p>
      ) : (
        <p className="text-xs text-zinc-500">Șofer opțional — selectează în formular</p>
      )}

      {reminderActionId ? (
        <BriefSection title="Reminder legat" defaultOpen>
          <Link href={`/fleet/reminders/${reminderActionId}`} className="text-xs text-violet-400 hover:underline">
            Vezi reminder sursă
          </Link>
        </BriefSection>
      ) : null}

      <BriefSection title="Tichete deschise vehicul" count={vehicleTickets.length}>
        {vehicleTickets.length === 0 ? (
          <p className="text-xs text-zinc-500">Niciun tichet deschis pentru acest vehicul.</p>
        ) : (
          <ul className="space-y-2">
            {vehicleTickets.map((t) => (
              <li key={t.id}>
                <Link href={`/fleet/tickets/${t.id}`} className="flex items-center gap-2 text-xs hover:text-white">
                  <TicketStatusBadge status={t.status} compact />
                  <span className="truncate text-zinc-300">{t.subject}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </BriefSection>

      {selectedVehicle ? (
        <BriefSection title="Vehicul selectat">
          <div className="flex items-center gap-2">
            <FleetAvatar name={selectedVehicle.registrationNumber} size={28} />
            <div>
              <p className="font-mono text-sm text-emerald-400">{selectedVehicle.registrationNumber}</p>
              <p className="text-[10px] text-zinc-500">{selectedVehicle.clientId}</p>
            </div>
          </div>
        </BriefSection>
      ) : null}
    </div>
  );
}
