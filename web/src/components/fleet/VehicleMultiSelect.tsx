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

  const selectedVehicles = vehicles.filter((v) => selected.has(v.id));
  const allFleet = selected.size === 0;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function remove(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelected(new Set(filtered.map((v) => v.id)));
  }

  function clearAll() {
    setSelected(new Set());
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={[...selected].join(",")} readOnly />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={clearAll}
          className={`shrink-0 rounded-lg px-3 py-2 text-sm ${
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
          className="shrink-0 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
        >
          {open ? "Ascunde" : "Alege…"}
        </button>
        {allFleet ? (
          <span className="text-xs text-zinc-500">Toate vehiculele</span>
        ) : (
          selectedVehicles.map((v) => (
            <span
              key={v.id}
              className="inline-flex max-w-full items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900/60 py-0.5 pl-2 pr-1 font-mono text-xs text-zinc-300"
            >
              <span className="truncate">{v.registrationNumber}</span>
              <button
                type="button"
                onClick={() => remove(v.id)}
                className="rounded px-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                aria-label={`Elimină ${v.registrationNumber}`}
                title={`Elimină ${v.registrationNumber}`}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>
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
