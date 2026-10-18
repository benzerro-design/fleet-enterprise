"use client";

import { useMemo, useState } from "react";
import { fleetJsonHeaders } from "@/lib/fleet-api";

type Rule = { clientId: string; userId: string; maxAmountCents: number };
type Settings = { currency: "RON"; basis: "net" | "gross"; rules: Rule[] };
type ClientOption = { id: string; code: string; legalName: string };
type Person = {
  userId: string;
  clientId: string;
  label: string;
  hint: string;
};

export function QuoteThresholdsEditor({
  initial,
  clients,
  people,
}: {
  initial: Settings;
  clients: ClientOption[];
  people: Person[];
}) {
  const [basis, setBasis] = useState<Settings["basis"]>(initial.basis);
  const [rules, setRules] = useState<Rule[]>(initial.rules);
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [amounts, setAmounts] = useState<Record<string, string>>(() => amountsForClient(initial.rules, clients[0]?.id ?? ""));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const clientPeople = useMemo(
    () => people.filter((p) => p.clientId === clientId),
    [people, clientId],
  );

  const selectedClient = clients.find((c) => c.id === clientId);

  function selectClient(nextId: string) {
    setClientId(nextId);
    setAmounts(amountsForClient(rules, nextId));
    setMessage(null);
  }

  async function save() {
    if (!clientId) {
      setMessage("Alege un client.");
      return;
    }
    setPending(true);
    setMessage(null);
    const clientRules: { userId: string; maxAmountCents: number }[] = [];
    for (const person of clientPeople) {
      const raw = amounts[person.userId]?.trim() ?? "";
      if (!raw) continue;
      const lei = Number(raw.replace(",", "."));
      if (!Number.isFinite(lei) || lei < 0) {
        setPending(false);
        setMessage(`Sumă invalidă pentru ${person.label}.`);
        return;
      }
      clientRules.push({ userId: person.userId, maxAmountCents: Math.round(lei * 100) });
    }
    const res = await fetch("/api/tenant/quote-approval-settings", {
      method: "PATCH",
      headers: fleetJsonHeaders(),
      body: JSON.stringify({ clientId, basis, rules: clientRules }),
    });
    setPending(false);
    if (!res.ok) {
      setMessage("Nu am putut salva.");
      return;
    }
    const next = (await res.json()) as Settings;
    setRules(next.rules);
    setBasis(next.basis);
    setAmounts(amountsForClient(next.rules, clientId));
    const name = selectedClient ? `${selectedClient.code}` : "client";
    setMessage(
      `Plafoanele pentru ${name} sunt salvate. La Aprobă pe comandă se verifică suma față de plafon.`,
    );
  }

  if (clients.length === 0) {
    return <p className="text-sm text-zinc-500">Niciun client activ. Adaugă un client, apoi revino aici.</p>;
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm text-zinc-400">
        Client
        <select
          value={clientId}
          onChange={(e) => selectClient(e.target.value)}
          className="mt-1 block w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.legalName}
            </option>
          ))}
        </select>
      </label>

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
        Userii clientului selectat: administrator și dispecer. Lasă gol pe cei fără plafon. Salvarea
        afectează doar acest client.
      </p>

      {clientPeople.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-700 px-4 py-6 text-sm text-zinc-500">
          Niciun administrator sau dispecer pe acest client. Adaugă-i din Membri & invitații → Client.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800">
          {clientPeople.map((person) => (
            <li
              key={`${person.clientId}:${person.userId}`}
              className="grid gap-2 bg-zinc-950/40 px-4 py-3 sm:grid-cols-[1fr_10rem] sm:items-center"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-zinc-100">{person.label}</p>
                <p className="truncate text-xs text-zinc-500">{person.hint}</p>
              </div>
              <label className="text-xs text-zinc-500">
                Plafon RON
                <input
                  inputMode="decimal"
                  value={amounts[person.userId] ?? ""}
                  onChange={(e) =>
                    setAmounts((prev) => ({ ...prev, [person.userId]: e.target.value }))
                  }
                  placeholder="fără plafon"
                  className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                />
              </label>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        disabled={pending || !clientId}
        onClick={() => void save()}
        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50"
      >
        Salvează plafoanele clientului
      </button>
      {message ? <p className="text-sm text-zinc-300">{message}</p> : null}
    </div>
  );
}

function amountsForClient(rules: Rule[], clientId: string): Record<string, string> {
  const map: Record<string, string> = {};
  if (!clientId) return map;
  for (const rule of rules) {
    if (rule.clientId !== clientId) continue;
    map[rule.userId] = (rule.maxAmountCents / 100).toFixed(2);
  }
  return map;
}

