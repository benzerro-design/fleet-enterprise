"use client";

import { useEffect, useState } from "react";
import { driversBrowserBase, type DriverRecord } from "@/lib/drivers-api";

type Props = {
  clientCode: string;
  value: string;
  onChange: (driverId: string) => void;
  disabled?: boolean;
  required?: boolean;
};

export function DriverSelect({ clientCode, value, onChange, disabled, required }: Props) {
  const [options, setOptions] = useState<DriverRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientCode.trim()) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${driversBrowserBase}?clientId=${encodeURIComponent(clientCode)}&status=active&pageSize=200`,
        );
        if (!res.ok) {
          if (!cancelled) setError("Nu s-au putut încărca șoferii.");
          return;
        }
        const data = (await res.json()) as { items: DriverRecord[] };
        if (!cancelled) setOptions(data.items);
      } catch {
        if (!cancelled) setError("Eroare la încărcarea șoferilor.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientCode]);

  useEffect(() => {
    if (value && options.length > 0 && !options.some((d) => d.id === value)) {
      onChange("");
    }
  }, [clientCode, options, value, onChange]);

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-zinc-400">
        Șofer {required ? <span className="text-rose-400">*</span> : null}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || loading || !clientCode.trim()}
        required={required}
        className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2 disabled:opacity-60"
      >
        <option value="">
          {!clientCode.trim()
            ? "Selectează vehicul mai întâi"
            : loading
              ? "Se încarcă…"
              : "Fără șofer / nealocat"}
        </option>
        {options.map((d) => (
          <option key={d.id} value={d.id}>
            {d.fullName}
            {d.employeeCode ? ` (${d.employeeCode})` : ""}
          </option>
        ))}
      </select>
      {error ? <p className="text-xs text-amber-400">{error}</p> : null}
      {!loading && clientCode && options.length === 0 ? (
        <p className="text-xs text-zinc-500">
          Niciun șofer activ pentru acest client.{" "}
          <a href="/fleet/drivers/new" className="text-emerald-400 hover:underline">
            Adaugă șofer
          </a>
        </p>
      ) : null}
    </div>
  );
}
