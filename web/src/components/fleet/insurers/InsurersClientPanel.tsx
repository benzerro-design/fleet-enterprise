"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { OPS_INPUT_CLASS, OPS_LABEL_CLASS } from "@/components/fleet/ops-form-primitives";
import {
  fleetJsonHeaders,
  insurersBrowserBase,
  type InsurerListPayload,
  type InsurerRecord,
} from "@/lib/insurers-api";

type Props = {
  initial: InsurerListPayload | null;
  canWrite: boolean;
  search: { q?: string; active?: string; page?: string };
};

export function InsurersClientPanel({ initial, canWrite, search }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<InsurerRecord[]>(initial?.items ?? []);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function createInsurer() {
    if (!name.trim()) {
      setError("Numele e obligatoriu.");
      return;
    }
    setPending(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(insurersBrowserBase, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          active: true,
        }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (j.message) msg = Array.isArray(j.message) ? j.message.join(", ") : j.message;
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      const row = (await res.json()) as InsurerRecord;
      setItems((prev) => [row, ...prev.filter((i) => i.id !== row.id)].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      setEmail("");
      setPhone("");
      setOk(`Adăugat: ${row.name}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function toggleActive(row: InsurerRecord) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${insurersBrowserBase}/${row.id}`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({ active: !row.active }),
      });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const next = (await res.json()) as InsurerRecord;
      setItems((prev) => prev.map((i) => (i.id === next.id ? next : i)));
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        className="flex flex-wrap items-end gap-2"
        action="/fleet/insurers"
        method="get"
      >
        <label className="block">
          <span className={OPS_LABEL_CLASS}>Caută</span>
          <input
            name="q"
            defaultValue={search.q ?? ""}
            className={OPS_INPUT_CLASS}
            placeholder="nume / email"
          />
        </label>
        <label className="block">
          <span className={OPS_LABEL_CLASS}>Status</span>
          <select name="active" defaultValue={search.active ?? ""} className={OPS_INPUT_CLASS}>
            <option value="">Toate</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
        >
          Filtrează
        </button>
        <Link href="/fleet/insurers" className="text-sm text-zinc-400 underline hover:text-zinc-200">
          Reset
        </Link>
      </form>

      {canWrite ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 space-y-3">
          <h3 className="text-sm font-medium text-zinc-100">Asigurător nou</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className={OPS_LABEL_CLASS}>Nume</span>
              <input className={OPS_INPUT_CLASS} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="block">
              <span className={OPS_LABEL_CLASS}>Email claims</span>
              <input
                type="email"
                className={OPS_INPUT_CLASS}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="block">
              <span className={OPS_LABEL_CLASS}>Telefon</span>
              <input className={OPS_INPUT_CLASS} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => void createInsurer()}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Adaugă
          </button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      {ok ? <p className="text-sm text-emerald-400">{ok}</p> : null}

      {!initial ? (
        <p className="text-sm text-rose-400">Nu am putut încărca catalogul.</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-500">Niciun asigurător încă.</p>
      ) : (
        <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
          {items.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
            >
              <div>
                <p className="font-medium text-zinc-100">{row.name}</p>
                <p className="text-xs text-zinc-500">
                  {row.email ?? "fără email"}
                  {row.phone ? ` · ${row.phone}` : ""}
                  {!row.active ? " · inactiv" : ""}
                </p>
              </div>
              {canWrite ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void toggleActive(row)}
                  className="text-xs text-zinc-400 underline hover:text-zinc-200 disabled:opacity-50"
                >
                  {row.active ? "Dezactivează" : "Reactivează"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {initial ? (
        <p className="text-[11px] text-zinc-600">
          {initial.total} în total · pagina {initial.page}
        </p>
      ) : null}
    </div>
  );
}
