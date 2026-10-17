"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { tripsBrowserBase, fleetJsonHeaders } from "@/lib/fleet-api";

type VehicleOption = { id: string; registrationNumber: string };
type DriverOption = { id: string; fullName: string };

type DayRow = {
  id: string;
  vehicleId: string;
  registrationNumber: string;
  driverId: string;
  driverName: string;
  day: string;
  drivingMinutes: number;
  otherWorkMinutes: number;
  availabilityMinutes: number;
  restMinutes: number;
  notes: string | null;
};

type Payload = {
  items: DayRow[];
  totals: {
    days: number;
    drivingMinutes: number;
    otherWorkMinutes: number;
    availabilityMinutes: number;
    restMinutes: number;
  };
};

function monthRange(now = new Date()) {
  const from = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const to = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

function hours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function TachographBoard({
  vehicles,
  drivers,
  canWrite,
  lockedDriverId,
  summaryOnly = false,
}: {
  vehicles: VehicleOption[];
  drivers: DriverOption[];
  canWrite: boolean;
  lockedDriverId?: string;
  summaryOnly?: boolean;
}) {
  const initial = monthRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [vehicleId, setVehicleId] = useState(vehicles.length === 1 ? vehicles[0]!.id : "");
  const [driverId, setDriverId] = useState(lockedDriverId ?? "");
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [driving, setDriving] = useState("0");
  const [otherWork, setOtherWork] = useState("0");
  const [availability, setAvailability] = useState("0");
  const [rest, setRest] = useState("0");
  const [notes, setNotes] = useState("");
  const [day, setDay] = useState(initial.to);

  const load = useCallback(async () => {
    const q = new URLSearchParams({ from, to });
    if (vehicleId) q.set("vehicleId", vehicleId);
    if (driverId) q.set("driverId", driverId);
    const res = await fetch(`${tripsBrowserBase}/tachograph-days?${q}`, { headers: fleetJsonHeaders() });
    if (!res.ok) {
      setError("Nu am putut încărca zilele de tahograf.");
      return;
    }
    setError(null);
    setData((await res.json()) as Payload);
  }, [from, to, vehicleId, driverId]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = data?.totals;
  const summary = useMemo(() => {
    if (!totals) return null;
    return [
      ["Zile", String(totals.days)],
      ["Condus", hours(totals.drivingMinutes)],
      ["Altă muncă", hours(totals.otherWorkMinutes)],
      ["Disponibilitate", hours(totals.availabilityMinutes)],
      ["Odihnă", hours(totals.restMinutes)],
    ] as const;
  }, [totals]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch(`${tripsBrowserBase}/tachograph-days`, {
      method: "PUT",
      headers: fleetJsonHeaders(),
      body: JSON.stringify({
        vehicleId,
        driverId: lockedDriverId || driverId,
        day,
        drivingMinutes: Number(driving) || 0,
        otherWorkMinutes: Number(otherWork) || 0,
        availabilityMinutes: Number(availability) || 0,
        restMinutes: Number(rest) || 0,
        notes,
      }),
    });
    setPending(false);
    if (!res.ok) {
      setError("Nu am putut salva ziua.");
      return;
    }
    await load();
  }

  async function remove(id: string) {
    setPending(true);
    await fetch(`${tripsBrowserBase}/tachograph-days/${id}`, { method: "DELETE", headers: fleetJsonHeaders() });
    setPending(false);
    await load();
  }

  return (
    <section className="min-w-0 space-y-4 overflow-x-hidden">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <p className="text-xs font-medium uppercase tracking-widest text-emerald-400/90">Lângă FAZ</p>
        <h2 className="mt-1 text-lg font-semibold text-zinc-100">Rezumat activitate zilnică</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Minute introduse manual pe vehicul, zi și conducător. Importul de card nu face parte din această felie.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(summary ?? []).map(([label, value]) => (
            <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
              <p className="mt-0.5 text-sm font-medium text-zinc-100">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {summaryOnly ? null : (
        <>
          <form
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              void load();
            }}
          >
            <label className="text-xs text-zinc-500">
              De la
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
            </label>
            <label className="text-xs text-zinc-500">
              Până la
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" />
            </label>
            <label className="text-xs text-zinc-500">
              Vehicul
              <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100">
                <option value="">Toate</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.registrationNumber}</option>
                ))}
              </select>
            </label>
            {lockedDriverId ? null : (
              <label className="text-xs text-zinc-500">
                Conducător
                <select value={driverId} onChange={(e) => setDriverId(e.target.value)} className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100">
                  <option value="">Toți</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>{d.fullName}</option>
                  ))}
                </select>
              </label>
            )}
          </form>

          {canWrite ? (
            <form onSubmit={(e) => void save(e)} className="grid gap-3 rounded-xl border border-zinc-800 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs text-zinc-500">
                Zi
                <input type="date" required value={day} onChange={(e) => setDay(e.target.value)} className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
              </label>
              <label className="text-xs text-zinc-500">
                Vehicul
                <select required value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
                  <option value="">Alege</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.registrationNumber}</option>
                  ))}
                </select>
              </label>
              {lockedDriverId ? null : (
                <label className="text-xs text-zinc-500">
                  Conducător
                  <select required value={driverId} onChange={(e) => setDriverId(e.target.value)} className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
                    <option value="">Alege</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>{d.fullName}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="text-xs text-zinc-500">
                Condus (min)
                <input inputMode="numeric" value={driving} onChange={(e) => setDriving(e.target.value)} className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
              </label>
              <label className="text-xs text-zinc-500">
                Altă muncă (min)
                <input inputMode="numeric" value={otherWork} onChange={(e) => setOtherWork(e.target.value)} className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
              </label>
              <label className="text-xs text-zinc-500">
                Disponibilitate (min)
                <input inputMode="numeric" value={availability} onChange={(e) => setAvailability(e.target.value)} className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
              </label>
              <label className="text-xs text-zinc-500">
                Odihnă (min)
                <input inputMode="numeric" value={rest} onChange={(e) => setRest(e.target.value)} className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
              </label>
              <label className="text-xs text-zinc-500 sm:col-span-2">
                Note
                <input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
              </label>
              <div className="flex items-end">
                <button type="submit" disabled={pending} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50">
                  Salvează ziua
                </button>
              </div>
            </form>
          ) : null}

          <ul className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800">
            {(data?.items ?? []).map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 bg-zinc-950/40 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-zinc-100">
                    {row.day} · {row.registrationNumber} · {row.driverName}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Condus {hours(row.drivingMinutes)} · Muncă {hours(row.otherWorkMinutes)} · Disp. {hours(row.availabilityMinutes)} · Odihnă {hours(row.restMinutes)}
                  </p>
                </div>
                {canWrite ? (
                  <button type="button" disabled={pending} onClick={() => void remove(row.id)} className="text-xs text-zinc-400 hover:text-red-300">
                    Șterge
                  </button>
                ) : null}
              </li>
            ))}
            {data && data.items.length === 0 ? (
              <li className="px-4 py-6 text-sm text-zinc-500">Nicio zi în perioada aleasă.</li>
            ) : null}
          </ul>
        </>
      )}
      {error ? <p className="text-sm text-amber-300">{error}</p> : null}
    </section>
  );
}
