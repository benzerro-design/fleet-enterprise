"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { clientsBrowserBase, fleetJsonHeaders, type ClientContactRecord } from "@/lib/clients-api";

const inputClass =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100";

type Props = {
  clientId: string;
  initialContacts: ClientContactRecord[];
};

type Draft = {
  fullName: string;
  role: string;
  email: string;
  phone: string;
  isPrimary: boolean;
};

const emptyDraft = (): Draft => ({
  fullName: "",
  role: "",
  email: "",
  phone: "",
  isPrimary: false,
});

async function readError(res: Response): Promise<string> {
  let msg = `HTTP ${res.status}`;
  try {
    const j = (await res.json()) as { message?: string | string[] };
    if (typeof j.message === "string") msg = j.message;
    else if (Array.isArray(j.message)) msg = j.message.join(", ");
  } catch {
    /* ignore */
  }
  return msg;
}

export function ClientContactsPanel({ clientId, initialContacts }: Props) {
  const router = useRouter();
  const [contacts, setContacts] = useState(initialContacts);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = `${clientsBrowserBase}/${clientId}/contacts`;

  async function refresh() {
    const res = await fetch(base);
    if (res.ok) {
      setContacts((await res.json()) as ClientContactRecord[]);
    }
    router.refresh();
  }

  async function onAdd() {
    if (!draft.fullName.trim()) {
      setError("Numele este obligatoriu.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          fullName: draft.fullName.trim(),
          role: draft.role.trim() || null,
          email: draft.email.trim() || null,
          phone: draft.phone.trim() || null,
          isPrimary: draft.isPrimary,
        }),
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      setDraft(emptyDraft());
      await refresh();
    } finally {
      setPending(false);
    }
  }

  function startEdit(contact: ClientContactRecord) {
    setEditingId(contact.id);
    setEditDraft({
      fullName: contact.fullName,
      role: contact.role ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      isPrimary: contact.isPrimary,
    });
    setError(null);
  }

  async function saveEdit(contactId: string) {
    if (!editDraft.fullName.trim()) {
      setError("Numele este obligatoriu.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${base}/${contactId}`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          fullName: editDraft.fullName.trim(),
          role: editDraft.role.trim() || null,
          email: editDraft.email.trim() || null,
          phone: editDraft.phone.trim() || null,
          isPrimary: editDraft.isPrimary,
        }),
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      setEditingId(null);
      await refresh();
    } finally {
      setPending(false);
    }
  }

  async function onDelete(contactId: string) {
    if (!window.confirm("Ștergi această persoană de contact?")) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${base}/${contactId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        setError(await readError(res));
        return;
      }
      if (editingId === contactId) setEditingId(null);
      await refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <h2 className="text-lg font-medium text-zinc-100">Persoane de contact</h2>
      <p className="mt-1 text-sm text-zinc-500">Reprezentanți ai companiei client — telefon și email.</p>

      {contacts.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">Nicio persoană adăugată.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {contacts.map((c) =>
            editingId === c.id ? (
              <li key={c.id} className="rounded-lg border border-zinc-700 bg-zinc-950/60 p-4">
                <ContactFields draft={editDraft} onChange={setEditDraft} />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => saveEdit(c.id)}
                    className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-60"
                  >
                    Salvează
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setEditingId(null)}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
                  >
                    Anulează
                  </button>
                </div>
              </li>
            ) : (
              <li
                key={c.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-zinc-100">
                    {c.fullName}
                    {c.isPrimary ? (
                      <span className="ml-2 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-300">
                        Principal
                      </span>
                    ) : null}
                  </p>
                  {c.role?.trim() ? <p className="text-sm text-zinc-400">{c.role}</p> : null}
                  <div className="mt-1 flex flex-col gap-0.5 text-sm text-zinc-300">
                    {c.phone?.trim() ? (
                      <a href={`tel:${c.phone}`} className="hover:text-emerald-300">
                        {c.phone}
                      </a>
                    ) : null}
                    {c.email?.trim() ? (
                      <a href={`mailto:${c.email}`} className="hover:text-emerald-300">
                        {c.email}
                      </a>
                    ) : null}
                    {!c.phone?.trim() && !c.email?.trim() ? (
                      <span className="text-zinc-600">Fără date de contact</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2 text-sm">
                  <button
                    type="button"
                    onClick={() => startEdit(c)}
                    className="text-emerald-400 hover:underline"
                  >
                    Editare
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(c.id)}
                    className="text-rose-400 hover:underline"
                  >
                    Șterge
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      <div className="mt-6 border-t border-zinc-800 pt-5">
        <h3 className="text-sm font-medium text-zinc-300">Adaugă persoană</h3>
        <div className="mt-3">
          <ContactFields draft={draft} onChange={setDraft} />
        </div>
        {error ? <p className="mt-2 text-sm text-rose-400">{error}</p> : null}
        <button
          type="button"
          disabled={pending}
          onClick={onAdd}
          className="mt-3 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700 disabled:opacity-60"
        >
          {pending ? "Se salvează…" : "Adaugă contact"}
        </button>
      </div>
    </section>
  );
}

function ContactFields({
  draft,
  onChange,
}: {
  draft: Draft;
  onChange: (next: Draft) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="text-xs text-zinc-500">Nume complet</label>
        <input
          value={draft.fullName}
          onChange={(e) => onChange({ ...draft, fullName: e.target.value })}
          className={`mt-1 ${inputClass}`}
          placeholder="ex. Ion Popescu"
        />
      </div>
      <div>
        <label className="text-xs text-zinc-500">Funcție / rol</label>
        <input
          value={draft.role}
          onChange={(e) => onChange({ ...draft, role: e.target.value })}
          className={`mt-1 ${inputClass}`}
          placeholder="ex. Fleet manager"
        />
      </div>
      <div className="flex items-end pb-2">
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <input
            type="checkbox"
            checked={draft.isPrimary}
            onChange={(e) => onChange({ ...draft, isPrimary: e.target.checked })}
            className="rounded border-zinc-600"
          />
          Contact principal
        </label>
      </div>
      <div>
        <label className="text-xs text-zinc-500">Telefon</label>
        <input
          value={draft.phone}
          onChange={(e) => onChange({ ...draft, phone: e.target.value })}
          className={`mt-1 ${inputClass}`}
          placeholder="+40 …"
        />
      </div>
      <div>
        <label className="text-xs text-zinc-500">Email</label>
        <input
          type="email"
          value={draft.email}
          onChange={(e) => onChange({ ...draft, email: e.target.value })}
          className={`mt-1 ${inputClass}`}
          placeholder="nume@firma.ro"
        />
      </div>
    </div>
  );
}
