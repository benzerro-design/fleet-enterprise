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
  slipFileUrl?: string | null;
  slipFileName?: string | null;
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
  canWrite,
  lockedDriverId,
  summaryOnly = false,
}: {
  vehicles: VehicleOption[];
  canWrite: boolean;
  lockedDriverId?: string;
  summaryOnly?: boolean;
}) {
  const initial = monthRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [vehicleId, setVehicleId] = useState(vehicles.length === 1 ? vehicles[0]!.id : "");
  const [filterDriverId, setFilterDriverId] = useState("");
  const [formDriverId, setFormDriverId] = useState(lockedDriverId ?? "");
  const [assignedDrivers, setAssignedDrivers] = useState<DriverOption[]>([]);
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [driving, setDriving] = useState("0");
  const [otherWork, setOtherWork] = useState("0");
  const [availability, setAvailability] = useState("0");
  const [rest, setRest] = useState("0");
  const [notes, setNotes] = useState("");
  const [slip, setSlip] = useState<{ url: string; name: string } | null>(null);
  const [day, setDay] = useState(initial.to);

  useEffect(() => {
    if (lockedDriverId || !vehicleId) {
      setAssignedDrivers([]);
      if (!lockedDriverId) setFormDriverId("");
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/fleet/vehicles/${vehicleId}/driver-assignments`);
      if (!res.ok || cancelled) return;
      const rows = (await res.json()) as {
        driverId: string;
        driverFullName?: string | null;
        unassignedAt: string | null;
      }[];
      if (cancelled) return;
      const active = rows
        .filter((row) => !row.unassignedAt)
        .map((row) => ({ id: row.driverId, fullName: row.driverFullName?.trim() || "Șofer" }));
      setAssignedDrivers(active);
      setFilterDriverId("");
      setFormDriverId(active.length === 1 ? active[0]!.id : "");
    })();
    return () => {
      cancelled = true;
    };
  }, [vehicleId, lockedDriverId]);

  const load = useCallback(async () => {
    const q = new URLSearchParams({ from, to });
    if (vehicleId) q.set("vehicleId", vehicleId);
    if (filterDriverId) q.set("driverId", filterDriverId);
    const res = await fetch(`${tripsBrowserBase}/tachograph-days?${q}`, { headers: fleetJsonHeaders() });
    if (!res.ok) {
      setError("Nu am putut încărca zilele de tahograf.");
      return;
    }
    setError(null);
    setData((await res.json()) as Payload);
  }, [from, to, vehicleId, filterDriverId]);

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

  async function readError(res: Response, fallback: string) {
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (typeof body.message === "string" && body.message.trim()) return body.message;
      if (Array.isArray(body.message) && body.message.length) return body.message.join(" ");
    } catch {
      /* răspuns fără JSON */
    }
    return fallback;
  }

  async function uploadSlip(file: File) {
    const form = new FormData();
    form.set("file", file);
    form.set("label", "tahograf");
    const res = await fetch("/api/uploads/documents", { method: "POST", body: form });
    if (!res.ok) {
      setError(await readError(res, "Nu am putut încărca bonul."));
      return;
    }
    const body = (await res.json()) as { url: string; name: string };
    setSlip({ url: body.url, name: body.name });
    setError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const chosenDriver = lockedDriverId || formDriverId;
    if (!vehicleId || !chosenDriver) {
      setError(assignedDrivers.length === 0 ? "Vehiculul nu are un șofer alocat." : "Alege conducătorul alocat pe vehicul.");
      return;
    }
    setPending(true);
    setError(null);
    const res = await fetch(`${tripsBrowserBase}/tachograph-days`, {
      method: "PUT",
      headers: fleetJsonHeaders(),
      body: JSON.stringify({
        vehicleId,
        driverId: chosenDriver,
        day,
        drivingMinutes: Number(driving) || 0,
        otherWorkMinutes: Number(otherWork) || 0,
        availabilityMinutes: Number(availability) || 0,
        restMinutes: Number(rest) || 0,
        notes,
        ...(slip ? { slipFileUrl: slip.url, slipFileName: slip.name } : {}),
      }),
    });
    setPending(false);
    if (!res.ok) {
      setError(await readError(res, "Nu am putut salva ziua."));
      return;
    }
    setSlip(null);
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
          Minute introduse manual, cu bonul de tahograf atașat la zi. Când apare importul de card, aceleași zile se completează automat.
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
                <select value={filterDriverId} onChange={(e) => setFilterDriverId(e.target.value)} disabled={!vehicleId} className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100">
                  <option value="">{vehicleId ? "Șoferii alocați" : "Alege vehiculul"}</option>
                  {assignedDrivers.map((d) => (
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
                  <select required value={formDriverId} onChange={(e) => setFormDriverId(e.target.value)} className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
                    <option value="">{assignedDrivers.length ? "Alege" : "Niciun șofer alocat"}</option>
                    {assignedDrivers.map((d) => (
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
              <label className="text-xs text-zinc-500 sm:col-span-2">
                Bon tahograf (PDF sau poză)
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadSlip(file);
                  }}
                  className="mt-1 block w-full text-sm text-zinc-300"
                />
                {slip ? <span className="mt-1 block text-zinc-400">{slip.name}</span> : null}
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
                    {row.slipFileUrl ? (
                      <>
                        {" · "}
                        <a href={row.slipFileUrl} target="_blank" rel="noreferrer" className="text-emerald-300 hover:underline">
                          {row.slipFileName || "Bon"}
                        </a>
                      </>
                    ) : null}
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
