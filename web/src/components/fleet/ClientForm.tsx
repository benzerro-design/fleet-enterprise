"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { clientsBrowserBase, fleetJsonHeaders, type ClientRecord, type ClientStatus } from "@/lib/clients-api";

type Props = {
  mode: "create" | "edit";
  initial?: ClientRecord;
};

export function ClientForm({ mode, initial }: Props) {
  const router = useRouter();
  const [code, setCode] = useState(initial?.code ?? "");
  const [legalName, setLegalName] = useState(initial?.legalName ?? "");
  const [taxId, setTaxId] = useState(initial?.taxId ?? "");
  const [contactEmail, setContactEmail] = useState(initial?.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(initial?.contactPhone ?? "");
  const [addressLine, setAddressLine] = useState(initial?.addressLine ?? "");
  const [tradeRegister, setTradeRegister] = useState(initial?.tradeRegister ?? "");
  const [billingNotes, setBillingNotes] = useState(initial?.billingNotes ?? "");
  const [status, setStatus] = useState<ClientStatus>(initial?.status ?? "active");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const body = {
      code: code.trim(),
      legalName: legalName.trim(),
      taxId: taxId.trim() || null,
      contactEmail: contactEmail.trim() || null,
      contactPhone: contactPhone.trim() || null,
      addressLine: addressLine.trim() || null,
      tradeRegister: tradeRegister.trim() || null,
      billingNotes: billingNotes.trim() || null,
      status,
      notes: notes.trim() || null,
    };
    try {
      const url =
        mode === "create" ? clientsBrowserBase : `${clientsBrowserBase}/${initial!.id}`;
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (typeof j.message === "string") msg = j.message;
          else if (Array.isArray(j.message)) msg = j.message.join(", ");
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      const saved = (await res.json()) as ClientRecord;
      router.push(mode === "create" ? `/fleet/clients/${saved.id}` : `/fleet/clients/${initial!.id}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const cancelHref =
    mode === "edit" && initial ? `/fleet/clients/${initial.id}` : "/fleet/clients";

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-6">
      <div>
        <label className="text-sm text-zinc-400">Cod client</label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          disabled={mode === "edit"}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 disabled:opacity-60"
          placeholder="ex. ALPHA"
        />
        {mode === "edit" ? (
          <p className="mt-1 text-xs text-zinc-500">Codul nu se poate modifica după creare.</p>
        ) : null}
      </div>
      <div>
        <label className="text-sm text-zinc-400">Denumire legală</label>
        <input
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
          required
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
      </div>
      <div>
        <label className="text-sm text-zinc-400">CUI (opțional)</label>
        <input
          value={taxId}
          onChange={(e) => setTaxId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
      </div>
      <div>
        <label className="text-sm text-zinc-400">Email contact</label>
        <input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
      </div>
      <div>
        <label className="text-sm text-zinc-400">Telefon contact</label>
        <input
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
      </div>
      <div>
        <label className="text-sm text-zinc-400">Adresă</label>
        <input
          value={addressLine}
          onChange={(e) => setAddressLine(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
      </div>
      <div>
        <label className="text-sm text-zinc-400">Reg. Comerțului</label>
        <input
          value={tradeRegister}
          onChange={(e) => setTradeRegister(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
      </div>
      <div>
        <label className="text-sm text-zinc-400">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ClientStatus)}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        >
          <option value="active">Activ</option>
          <option value="inactive">Inactiv</option>
        </select>
      </div>
      <div>
        <label className="text-sm text-zinc-400">Note facturare</label>
        <textarea
          value={billingNotes}
          onChange={(e) => setBillingNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
      </div>
      <div>
        <label className="text-sm text-zinc-400">Note interne</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
      </div>
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-60"
        >
          {pending ? "Se salvează…" : mode === "create" ? "Creează client" : "Salvează"}
        </button>
        <Link
          href={cancelHref}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
        >
          Anulează
        </Link>
      </div>
    </form>
  );
}
