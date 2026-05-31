"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  fleetBrowserBase,
  fleetJsonHeaders,
  type VehicleTypeValue,
  VEHICLE_TYPES,
} from "@/lib/fleet-api";

export function VehicleForm() {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [type, setType] = useState<VehicleTypeValue>("car");
  const [vin, setVin] = useState("");
  const [odometerKm, setOdometerKm] = useState("0");
  const [itpDate, setItpDate] = useState("");
  const [itpStationName, setItpStationName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    try {
      const odo = Number(odometerKm);
      if (!Number.isFinite(odo) || odo < 0) {
        setError("Kilometraj invalid.");
        return;
      }

      const body: Record<string, unknown> = {
        clientId: clientId.trim(),
        registrationNumber: registrationNumber.trim(),
        type,
        odometerKm: odo,
      };
      const v = vin.trim();
      if (v) body.vin = v;
      if (itpDate) body.itpExpiresOn = `${itpDate}T12:00:00.000Z`;
      const s = itpStationName.trim();
      if (s) body.itpStationName = s;

      const res = await fetch(`${fleetBrowserBase}/vehicles`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (typeof j.message === "string") msg = j.message;
          else if (Array.isArray(j.message)) msg = j.message.join(", ");
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      const created = (await res.json()) as { id: string };
      router.push(`/fleet/vehicles/${created.id}?tab=basic`);
      router.refresh();
    } catch {
      setError("Rețea sau server indisponibil.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mx-auto max-w-xl space-y-6">
      {error ? (
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Client (ID)</label>
        <input
          required
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
          placeholder="ex. client-1"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Număr înmatriculare</label>
        <input
          required
          value={registrationNumber}
          onChange={(e) => setRegistrationNumber(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
          placeholder="ex. B 123 ABC"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Tip vehicul</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as VehicleTypeValue)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
        >
          {VEHICLE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">VIN (opțional)</label>
        <input
          value={vin}
          onChange={(e) => setVin(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
          placeholder="—"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Kilometraj inițial (odometru)</label>
        <input
          required
          type="number"
          min={0}
          step={1}
          value={odometerKm}
          onChange={(e) => setOdometerKm(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
        />
        <p className="text-xs text-zinc-500">
          La creare se înregistrează prima citire. Actualizările ulterioare se fac din tab-ul Odometru.
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">ITP — dată expirare (opțional)</label>
        <input
          type="date"
          value={itpDate}
          onChange={(e) => setItpDate(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">ITP — stație (opțional)</label>
        <input
          value={itpStationName}
          onChange={(e) => setItpStationName(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
          placeholder="ex. RAR București"
        />
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          {pending ? "Salvez…" : "Creează vehicul"}
        </button>
        <Link
          href="/fleet/vehicles"
          className="inline-flex items-center rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
        >
          Anulează
        </Link>
      </div>
    </form>
  );
}
