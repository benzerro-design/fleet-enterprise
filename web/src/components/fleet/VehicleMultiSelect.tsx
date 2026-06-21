"use client";

import { useMemo, useState } from "react";

export type VehicleMultiSelectOption = {
  id: string;
  registrationNumber: string;
  clientId: string;
};

type Props = {
  vehicles: VehicleMultiSelectOption[];
  selectedIds: string[];
  name?: string;
};

export function VehicleMultiSelect({ vehicles, selectedIds, name = "vehicleIds" }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [clientQ, setClientQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(selectedIds));

  const filtered = useMemo(() => {
    const c = clientQ.trim().toLowerCase();
    const q = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (c && !v.clientId.toLowerCase().includes(c)) return false;
      if (q && !v.registrationNumber.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [vehicles, clientQ, search]);

  const allFleet = selected.size === 0;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelected(new Set(filtered.map((v) => v.id)));
  }

  function clearAll() {
    setSelected(new Set());
  }

  const selectedPlates = vehicles.filter((v) => selected.has(v.id)).map((v) => v.registrationNumber);

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={[...selected].join(",")} readOnly />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            clearAll();
          }}
          className={`rounded-lg px-3 py-1.5 text-sm ${
            allFleet
              ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
              : "border border-zinc-700 text-zinc-300 hover:bg-zinc-900"
          }`}
        >
          Toată flota
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
        >
          {open ? "Ascunde selector" : "Alege vehicule…"}
        </button>
        <span className="text-xs text-zinc-500">
          {allFleet ? "Toate vehiculele" : `${selected.size} selectate`}
        </span>
      </div>
      {!allFleet && selectedPlates.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedPlates.slice(0, 5).map((plate) => (
            <span
              key={plate}
              className="rounded-md border border-zinc-700 bg-zinc-900/60 px-2 py-0.5 font-mono text-xs text-zinc-300"
            >
              {plate}
            </span>
          ))}
          {selectedPlates.length > 5 ? (
            <span className="text-xs text-zinc-500">+{selectedPlates.length - 5} altele</span>
          ) : null}
        </div>
      ) : null}
      {open ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Caută nr. înmatriculare…"
              className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
            <input
              value={clientQ}
              onChange={(e) => setClientQ(e.target.value)}
              placeholder="Filtru client"
              className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-2 flex gap-3 text-xs">
            <button type="button" onClick={selectAllFiltered} className="text-emerald-400 hover:underline">
              Selectează filtrate ({filtered.length})
            </button>
            <button type="button" onClick={clearAll} className="text-zinc-400 hover:underline">
              Golește selecția
            </button>
          </div>
          <ul className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-zinc-800">
            {filtered.length === 0 ? (
              <li className="p-3 text-sm text-zinc-500">Niciun vehicul.</li>
            ) : (
              filtered.map((v) => (
                <li key={v.id} className="border-b border-zinc-800 last:border-0">
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-zinc-900/60">
                    <input type="checkbox" checked={selected.has(v.id)} onChange={() => toggle(v.id)} />
                    <span className="font-mono text-zinc-200">{v.registrationNumber}</span>
                    <span className="text-zinc-500">{v.clientId}</span>
                  </label>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
