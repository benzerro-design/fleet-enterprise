"use client";

import { useMemo, useState } from "react";
import { fleetJsonHeaders } from "@/lib/fleet-api";

type Rule = { userId: string; maxAmountCents: number };
type Settings = { currency: "RON"; basis: "net" | "gross"; rules: Rule[] };
type Person = { userId: string; label: string; hint: string };

export function QuoteThresholdsEditor({
  initial,
  people,
}: {
  initial: Settings;
  people: Person[];
}) {
  const [basis, setBasis] = useState<Settings["basis"]>(initial.basis);
  const [amounts, setAmounts] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const rule of initial.rules) {
      map[rule.userId] = (rule.maxAmountCents / 100).toFixed(2);
    }
    return map;
  });
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const rows = useMemo(() => people, [people]);

  async function save() {
    setPending(true);
    setMessage(null);
    const rules: Rule[] = [];
    for (const person of rows) {
      const raw = amounts[person.userId]?.trim() ?? "";
      if (!raw) continue;
      const lei = Number(raw.replace(",", "."));
      if (!Number.isFinite(lei) || lei < 0) {
        setPending(false);
        setMessage(`Sumă invalidă pentru ${person.label}.`);
        return;
      }
      rules.push({ userId: person.userId, maxAmountCents: Math.round(lei * 100) });
    }
    const res = await fetch("/api/tenant/quote-approval-settings", {
      method: "PATCH",
      headers: fleetJsonHeaders(),
      body: JSON.stringify({ currency: "RON", basis, rules }),
    });
    setPending(false);
    setMessage(res.ok ? "Plafoanele sunt salvate. Nu se aplică încă la aprobarea devizului." : "Nu am putut salva.");
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm text-zinc-400">
        Totalul față de care se va compara plafonul
        <select
          value={basis}
          onChange={(e) => setBasis(e.target.value === "net" ? "net" : "gross")}
          className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        >
          <option value="gross">Brut</option>
          <option value="net">Net</option>
        </select>
      </label>
      <p className="text-sm text-zinc-500">
        Lasă gol userii fără plafon. Valorile se salvează aici; aprobarea din deviz rămâne neschimbată până la pasul de producție.
      </p>
      <ul className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800">
        {rows.map((person) => (
          <li key={person.userId} className="grid gap-2 bg-zinc-950/40 px-4 py-3 sm:grid-cols-[1fr_10rem] sm:items-center">
            <div className="min-w-0">
              <p className="truncate text-sm text-zinc-100">{person.label}</p>
              <p className="truncate text-xs text-zinc-500">{person.hint}</p>
            </div>
            <label className="text-xs text-zinc-500">
              Plafon RON
              <input
                inputMode="decimal"
                value={amounts[person.userId] ?? ""}
                onChange={(e) => setAmounts((prev) => ({ ...prev, [person.userId]: e.target.value }))}
                placeholder="fără plafon"
                className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              />
            </label>
          </li>
        ))}
      </ul>
      <button type="button" disabled={pending} onClick={() => void save()} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50">
        Salvează plafoanele
      </button>
      {message ? <p className="text-sm text-zinc-300">{message}</p> : null}
    </div>
  );
}
