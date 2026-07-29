"use client";

import { useEffect, useMemo, useState } from "react";
import { fleetJsonHeaders } from "@/lib/fleet-api";
import {
  mailSettingsBrowserBase,
  type TenantMailSettings,
} from "@/lib/mail-settings";

type Member = {
  userId: string;
  email: string;
  displayName: string | null;
  role: string;
};

type Props = {
  initial: TenantMailSettings;
};

export function MailSettingsEditor({ initial }: Props) {
  const [settings, setSettings] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [members, setMembers] = useState<Member[]>([]);
  const [ccExtraText, setCcExtraText] = useState(initial.defaultCcEmails.join(", "));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/tenant/members", { headers: fleetJsonHeaders() });
        if (!res.ok) return;
        const data = (await res.json()) as { members?: Member[] };
        if (!cancelled) setMembers(data.members ?? []);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(settings) || ccExtraText !== settings.defaultCcEmails.join(", "),
    [draft, settings, ccExtraText],
  );

  function parseCcExtra(text: string): string[] {
    const parts = text.split(/[,;\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    const out: string[] = [];
    const seen = new Set<string>();
    for (const e of parts) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || seen.has(e)) continue;
      seen.add(e);
      out.push(e);
    }
    return out.slice(0, 20);
  }

  async function save() {
    setPending(true);
    setError(null);
    setSaved(false);
    const payload: TenantMailSettings = {
      ...draft,
      defaultCcEmails: parseCcExtra(ccExtraText),
    };
    try {
      const res = await fetch(mailSettingsBrowserBase, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        const msg = Array.isArray(j.message) ? j.message.join(", ") : j.message;
        throw new Error(msg ?? `HTTP ${res.status}`);
      }
      const next = (await res.json()) as TenantMailSettings;
      setSettings(next);
      setDraft(next);
      setCcExtraText(next.defaultCcEmails.join(", "));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setPending(false);
    }
  }

  function toggleMember(userId: string) {
    setDraft((d) => {
      const has = d.ccMemberUserIds.includes(userId);
      return {
        ...d,
        ccMemberUserIds: has
          ? d.ccMemberUserIds.filter((id) => id !== userId)
          : [...d.ccMemberUserIds, userId],
      };
    });
  }

  return (
    <div className="max-w-2xl space-y-4">
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-400">Salvat.</p> : null}

      <div className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">Identitate expeditor</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Adresa tehnică From rămâne cea din SMTP (Gmail). Aici setezi numele afișat, Reply-To și
            semnătura pentru avizare / reconstatare / deviz.
          </p>
        </div>

        <label className="block space-y-1 text-sm text-zinc-300">
          <span className="font-medium text-zinc-100">Nume From</span>
          <input
            type="text"
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            placeholder="ex. FlotaX Daune"
            value={draft.fromName ?? ""}
            disabled={pending}
            onChange={(e) =>
              setDraft((d) => ({ ...d, fromName: e.target.value.trim() ? e.target.value : null }))
            }
          />
        </label>

        <label className="block space-y-1 text-sm text-zinc-300">
          <span className="font-medium text-zinc-100">Reply-To</span>
          <input
            type="email"
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            placeholder="ex. daune@firma.ro"
            value={draft.replyTo ?? ""}
            disabled={pending}
            onChange={(e) =>
              setDraft((d) => ({ ...d, replyTo: e.target.value.trim() ? e.target.value.trim() : null }))
            }
          />
          <span className="block text-xs text-zinc-500">
            Răspunsurile asigurătorului vor merge aici (nu neapărat pe Gmail-ul SMTP).
          </span>
        </label>

        <label className="block space-y-1 text-sm text-zinc-300">
          <span className="font-medium text-zinc-100">Semnătură</span>
          <textarea
            rows={3}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            placeholder="ex. Echipa Daune · FlotaX"
            value={draft.signature ?? ""}
            disabled={pending}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                signature: e.target.value.trim() ? e.target.value : null,
              }))
            }
          />
          <span className="block text-xs text-zinc-500">
            Dacă e gol, se folosește „Fleet Enterprise”.
          </span>
        </label>
      </div>

      <div className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">CC pe trimiteri daună</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Copii la avizare, reconstatare și trimite deviz. Folosește emailurile de login ale membrilor.
          </p>
        </div>

        <label className="flex items-start gap-3 text-sm text-zinc-300">
          <input
            type="checkbox"
            className="mt-1"
            checked={draft.ccActorOnSend}
            disabled={pending}
            onChange={(e) => setDraft((d) => ({ ...d, ccActorOnSend: e.target.checked }))}
          />
          <span>
            <span className="font-medium text-zinc-100">CC pe cel care apasă Trimite</span>
            <span className="mt-0.5 block text-xs text-zinc-500">
              Adaugă automat emailul utilizatorului care trimite mailul.
            </span>
          </span>
        </label>

        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-100">Membri în CC</p>
          {members.length === 0 ? (
            <p className="text-xs text-zinc-500">Nu s-au putut încărca membrii (sau lista e goală).</p>
          ) : (
            <ul className="max-h-56 space-y-1 overflow-y-auto rounded border border-zinc-800 p-2">
              {members.map((m) => (
                <li key={m.userId}>
                  <label className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={draft.ccMemberUserIds.includes(m.userId)}
                      disabled={pending}
                      onChange={() => toggleMember(m.userId)}
                    />
                    <span>
                      <span className="font-medium text-zinc-100">
                        {m.displayName?.trim() || m.email}
                      </span>
                      <span className="mt-0.5 block text-xs text-zinc-500">{m.email}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className="block space-y-1 text-sm text-zinc-300">
          <span className="font-medium text-zinc-100">CC suplimentar (adrese libere)</span>
          <input
            type="text"
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            placeholder="contabilitate@firma.ro, manager@firma.ro"
            value={ccExtraText}
            disabled={pending}
            onChange={(e) => setCcExtraText(e.target.value)}
          />
          <span className="block text-xs text-zinc-500">Separate prin virgulă.</span>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending || !dirty}
          onClick={() => void save()}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {pending ? "Se salvează…" : "Salvează"}
        </button>
        {dirty ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setDraft(settings);
              setCcExtraText(settings.defaultCcEmails.join(", "));
              setError(null);
              setSaved(false);
            }}
            className="text-sm text-zinc-400 hover:text-zinc-200"
          >
            Anulează
          </button>
        ) : null}
      </div>
    </div>
  );
}
