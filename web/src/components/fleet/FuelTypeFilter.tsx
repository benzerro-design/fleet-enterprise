"use client";

import { useState } from "react";
import { CONSUMPTION_FUEL_FILTER_OPTIONS, type FuelTypeValue } from "@/lib/fuel-types";

type Props = {
  selected: FuelTypeValue[];
  name?: string;
};

export function FuelTypeFilter({ selected, name = "fuelTypes" }: Props) {
  const [active, setActive] = useState<Set<FuelTypeValue>>(() => new Set(selected));

  function toggle(value: FuelTypeValue) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function clearAll() {
    setActive(new Set());
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="hidden" name={name} value={[...active].join(",")} readOnly />
      <button
        type="button"
        onClick={clearAll}
        className={`shrink-0 rounded-lg px-3 py-2 text-sm ${
          active.size === 0
            ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
            : "border border-zinc-700 text-zinc-300 hover:bg-zinc-900"
        }`}
      >
        Toate tipurile
      </button>
      {CONSUMPTION_FUEL_FILTER_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => toggle(o.value)}
          className={`shrink-0 rounded-lg px-3 py-2 text-sm ${
            active.has(o.value)
              ? "bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40"
              : "border border-zinc-700 text-zinc-300 hover:bg-zinc-900"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
