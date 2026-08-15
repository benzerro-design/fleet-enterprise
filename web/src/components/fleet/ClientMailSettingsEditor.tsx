"use client";

import { useEffect, useMemo, useState } from "react";
import { fleetJsonHeaders } from "@/lib/fleet-api";
import { clientsBrowserBase } from "@/lib/clients-api";
import {
  DEFAULT_CLIENT_MAIL_SETTINGS,
  type ClientMailSettings,
  type ClientMailSettingsPayload,
} from "@/lib/client-mail-settings";

type Props = {
  clientId: string;
  canWrite: boolean;
};

export function ClientMailSettingsEditor({ clientId, canWrite }: Props) {
  const [settings, setSettings] = useState<ClientMailSettings>(DEFAULT_CLIENT_MAIL_SETTINGS);
  const [draft, setDraft] = useState<ClientMailSettings>(DEFAULT_CLIENT_MAIL_SETTINGS);
  const [members, setMembers] = useState<ClientMailSettingsPayload["members"]>([]);
  const [ccExtraText, setCcExtraText] = useState("");
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${clientsBrowserBase}/${clientId}/mail-settings`, {
          headers: fleetJsonHeaders(),
        });
        if (!res.ok) {
          if (!cancelled) setError(`HTTP ${res.status}`);
          return;
        }
        const data = (await res.json()) as ClientMailSettingsPayload;
        if (cancelled) return;
        const next: ClientMailSettings = {
          ccMemberUserIds: data.ccMemberUserIds ?? [],
          ccEmails: data.ccEmails ?? [],
        };
        setSettings(next);
        setDraft(next);
        setCcExtraText(next.ccEmails.join(", "));
        setMembers(data.members ?? []);
      } catch {
        if (!cancelled) setError("Nu s-au putut încărca setările.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const dirty = useMemo(
    () =>
      JSON.stringify(draft) !== JSON.stringify(settings) ||
      ccExtraText !== settings.ccEmails.join(", "),
    [draft, settings, ccExtraText],
  );

  function parseCcExtra(text: string): string[] {
    const parts = text
      .split(/[,;\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const out: string[] = [];
    const seen = new Set<string>();
    for (const e of parts) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || seen.has(e)) continue;
      seen.add(e);
      out.push(e);
    }
    return out.slice(0, 20);
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
    setSaved(false);
  }

  async function save() {
    if (!canWrite) return;
    setPending(true);
    setError(null);
    setSaved(false);
    const payload: ClientMailSettings = {
      ccMemberUserIds: draft.ccMemberUserIds,
      ccEmails: parseCcExtra(ccExtraText),
    };
    try {
      const res = await fetch(`${clientsBrowserBase}/${clientId}/mail-settings`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        const msg = Array.isArray(j.message) ? j.message.join(", ") : j.message;
        setError(msg ?? `HTTP ${res.status}`);
        return;
      }
      const next = (await res.json()) as ClientMailSettings;
      setSettings(next);
      setDraft(next);
      setCcExtraText(next.ccEmails.join(", "));
      setSaved(true);
    } catch {
      setError("Salvare eșuată.");
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return <p className="p-4 text-sm text-zinc-500">Se încarcă corespondența…</p>;
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h2 className="text-sm font-medium text-zinc-200">Corespondență daună (CC)</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Cine din partea acestui client intră în CC la mailurile către asigurător (avizare,
          reconstatare, deviz). Se combină automat cu CC-ul flotă din Setup → Email.
        </p>
      </div>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-400">Salvat.</p> : null}

      <div className="space-y-2">
        <p className="text-sm font-medium text-zinc-100">Utilizatori client în CC</p>
        {members.length === 0 ? (
          <p className="text-xs text-zinc-500">
            Niciun utilizator legat de acest client. Adaugă membership-uri client sau folosește
            adrese libere mai jos.
          </p>
        ) : (
          <ul className="max-h-56 space-y-1 overflow-y-auto rounded border border-zinc-800 p-2">
            {members.map((m) => (
              <li key={m.userId}>
                <label className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={draft.ccMemberUserIds.includes(m.userId)}
                    disabled={pending || !canWrite}
                    onChange={() => toggleMember(m.userId)}
                  />
                  <span>
                    <span className="font-medium text-zinc-100">
                      {m.displayName?.trim() || m.email}
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      {m.email}
                      {m.role ? ` · ${m.role}` : ""}
                    </span>
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
          placeholder="contabilitate@client.ro, fleet@client.ro"
          value={ccExtraText}
          disabled={pending || !canWrite}
          onChange={(e) => {
            setCcExtraText(e.target.value);
            setSaved(false);
          }}
        />
        <span className="block text-xs text-zinc-500">Separate prin virgulă.</span>
      </label>

      {canWrite ? (
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
                setCcExtraText(settings.ccEmails.join(", "));
                setError(null);
                setSaved(false);
              }}
              className="text-sm text-zinc-400 hover:text-zinc-200"
            >
              Anulează
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-zinc-500">Doar adminul poate modifica aceste setări.</p>
      )}
    </div>
  );
}
