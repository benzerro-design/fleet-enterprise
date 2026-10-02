"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { fleetBrowserBase, fleetJsonHeaders } from "@/lib/fleet-api";
import type { FuelLevelReadingsPayload, FuelLevelReadingRow } from "@/lib/vehicle-profile-types";
import { formatDateRo } from "@/lib/datetime-local";

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  import: "Import",
  telematics: "Telemetrie",
};

type Props = {
  vehicleId: string;
  write: boolean;
  initial: FuelLevelReadingsPayload;
};

export function VehicleFuelLevelPanel({ vehicleId, write, initial }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<FuelLevelReadingRow[]>(initial.items);
  const [liters, setLiters] = useState("");
  const [percent, setPercent] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!write) return;
    const L = liters.trim() === "" ? null : Number(liters.replace(",", "."));
    const P = percent.trim() === "" ? null : Number(percent.replace(",", "."));
    if ((L == null || !Number.isFinite(L)) && (P == null || !Number.isFinite(P))) {
      setError("Introduceți litri și/sau procent (0–100).");
      return;
    }
    if (L != null && (!Number.isFinite(L) || L < 0)) {
      setError("Litrii trebuie să fie ≥ 0.");
      return;
    }
    if (P != null && (!Number.isFinite(P) || P < 0 || P > 100)) {
      setError("Procentul trebuie să fie între 0 și 100.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${fleetBrowserBase}/vehicles/${vehicleId}/fuel-level-readings`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          liters: L,
          percent: P,
          notes: notes.trim() || null,
          source: "manual",
        }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (typeof j.message === "string") msg = j.message;
          else if (Array.isArray(j.message)) msg = j.message.join(", ");
        } catch {}
        setError(msg);
        return;
      }
      const data = (await res.json()) as { reading: FuelLevelReadingRow };
      setItems((prev) => [data.reading, ...prev]);
      setLiters("");
      setPercent("");
      setNotes("");
      router.refresh();
    } catch {
      setError("Rețea sau server indisponibil.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
      <div>
        <h3 className="text-sm font-medium text-zinc-200">Nivel rezervor</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Înregistrare manuală (litri și/sau %). Telemetrie / import — fază ulterioară.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
          {error}
        </p>
      ) : null}

      {write ? (
        <form onSubmit={(e) => void onSubmit(e)} className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="block text-xs text-zinc-500">Litri</label>
            <input
              value={liters}
              onChange={(e) => setLiters(e.target.value)}
              disabled={pending}
              inputMode="decimal"
              placeholder="ex. 42"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500">Procent %</label>
            <input
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              disabled={pending}
              inputMode="decimal"
              placeholder="0–100"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-zinc-500">Note</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={pending}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <div className="sm:col-span-4">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {pending ? "Salvez…" : "Adaugă citire"}
            </button>
          </div>
        </form>
      ) : null}

      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">Nicio citire de nivel încă.</p>
      ) : (
        <ul className="divide-y divide-zinc-800/80 rounded-lg border border-zinc-800">
          {items.slice(0, 20).map((row) => (
            <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm">
              <span className="text-zinc-100">
                {row.liters != null ? `${row.liters.toLocaleString("ro-RO")} L` : "—"}
                {row.percent != null ? ` · ${row.percent.toLocaleString("ro-RO")} %` : ""}
                {row.notes ? <span className="ml-2 text-xs text-zinc-500">{row.notes}</span> : null}
              </span>
              <span className="text-xs text-zinc-500">
                {formatDateRo(row.recordedAt)} · {SOURCE_LABELS[row.source] ?? row.source}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
