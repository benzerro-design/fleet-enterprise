"use client";

import { useEffect, useState } from "react";
import { driversBrowserBase, type DriverRecord } from "@/lib/drivers-api";

type Props = {
  drivers: DriverRecord[];
  value: string;
  name?: string;
  compact?: boolean;
};

const fieldLabel = "text-[10px] font-medium uppercase tracking-wide text-zinc-500";
const fieldInput = "rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs";

/** Server-provided driver list for GET form filters. */
export function DriverFilterSelect({ drivers, value, name = "driverId", compact }: Props) {
  const [options, setOptions] = useState(drivers);

  useEffect(() => {
    if (drivers.length > 0) {
      setOptions(drivers);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${driversBrowserBase}?status=active&pageSize=200`);
        if (!res.ok) return;
        const data = (await res.json()) as { items: DriverRecord[] };
        if (!cancelled) setOptions(data.items);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [drivers]);

  return (
    <div className={compact ? "flex flex-col gap-0.5" : "flex min-w-[10rem] flex-col gap-1"}>
      <label className={compact ? fieldLabel : "text-xs font-medium text-zinc-500"}>Șofer</label>
      <select
        name={name}
        defaultValue={value}
        className={compact ? `${fieldInput} min-w-[10rem]` : "rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"}
      >
        <option value="">Toți</option>
        {options.map((d) => (
          <option key={d.id} value={d.id}>
            {d.fullName} — {d.clientCode}
          </option>
        ))}
      </select>
    </div>
  );
}
