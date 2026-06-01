"use client";

import { useEffect, useState } from "react";
import { clientsBrowserBase, type ClientListPayload } from "@/lib/clients-api";

type Props = {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  required?: boolean;
};

export function ClientSelect({ value, onChange, disabled, required }: Props) {
  const [options, setOptions] = useState<Array<{ code: string; legalName: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${clientsBrowserBase}?status=active&pageSize=200`);
        if (!res.ok) {
          if (!cancelled) setError("Nu s-au putut încărca clienții.");
          return;
        }
        const data = (await res.json()) as ClientListPayload;
        if (!cancelled) {
          setOptions(
            data.items.map((c) => ({ code: c.code, legalName: c.legalName })),
          );
        }
      } catch {
        if (!cancelled) setError("Eroare la încărcarea clienților.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-zinc-400">
        Client {required ? <span className="text-rose-400">*</span> : null}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || loading}
        required={required}
        className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2 disabled:opacity-60"
      >
        <option value="">{loading ? "Se încarcă…" : "Selectează client"}</option>
        {options.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code} — {c.legalName}
          </option>
        ))}
      </select>
      {error ? <p className="text-xs text-amber-400">{error}</p> : null}
      {!loading && options.length === 0 ? (
        <p className="text-xs text-zinc-500">
          Niciun client activ.{" "}
          <a href="/fleet/clients/new" className="text-emerald-400 hover:underline">
            Adaugă client
          </a>
        </p>
      ) : null}
    </div>
  );
}
