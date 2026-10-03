"use client";

import { useCallback, useEffect, useState } from "react";
import { OPS_INPUT_CLASS, OPS_LABEL_CLASS } from "@/components/fleet/ops-form-primitives";
import { clientsBrowserBase } from "@/lib/clients-api";
import { fleetJsonHeaders } from "@/lib/fleet-api";
import {
  DEFAULT_CLIENT_SLA_SETTINGS,
  SLA_PRIORITY_LABELS,
  type ClientSlaSettings,
  type SlaPriorityKey,
} from "@/lib/client-sla-settings";

type Props = {
  clientId: string;
  canWrite: boolean;
};

const KEYS: SlaPriorityKey[] = ["urgent", "high", "normal", "low"];

export function ClientSlaSettingsEditor({ clientId, canWrite }: Props) {
  const [draft, setDraft] = useState<ClientSlaSettings>(DEFAULT_CLIENT_SLA_SETTINGS);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${clientsBrowserBase}/${clientId}/sla-settings`, {
        headers: fleetJsonHeaders(),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ClientSlaSettings;
      setDraft({
        override: data.override === true,
        priorities: {
          ...DEFAULT_CLIENT_SLA_SETTINGS.priorities,
          ...(data.priorities ?? {}),
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Încărcare eșuată");
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!canWrite) return;
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`${clientsBrowserBase}/${clientId}/sla-settings`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const next = (await res.json()) as ClientSlaSettings;
      setDraft(next);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvare eșuată");
    } finally {
      setPending(false);
    }
  }

  function setHours(key: SlaPriorityKey, field: "firstResponseHours" | "resolveHours", value: number) {
    setDraft((d) => ({
      ...d,
      priorities: {
        ...d.priorities,
        [key]: { ...d.priorities[key], [field]: value },
      },
    }));
  }

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-100">SLA (override)</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Implicit moștenește Setup → Tipuri &amp; servicii → SLA. Activează override pentru ore pe
          prioritate doar pe acest client.
        </p>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-400">Salvat.</p> : null}

      <label className="flex items-start gap-3 text-sm text-zinc-300">
        <input
          type="checkbox"
          className="mt-1"
          checked={draft.override}
          disabled={!canWrite || pending}
          onChange={(e) => setDraft((d) => ({ ...d, override: e.target.checked }))}
        />
        <span>
          <span className="font-medium text-zinc-100">Override SLA pe acest client</span>
          <span className="mt-0.5 block text-xs text-zinc-500">
            Oprit = valorile din Setup tenant. Pornit = orele de mai jos la creare / schimbare prioritate.
          </span>
        </span>
      </label>

      {draft.override ? (
        <div className="space-y-3 rounded-xl border border-zinc-800 p-4">
          {KEYS.map((key) => (
            <div key={key} className="grid gap-2 sm:grid-cols-[7rem_1fr_1fr] sm:items-end">
              <div className="text-xs font-medium text-zinc-400">{SLA_PRIORITY_LABELS[key]}</div>
              <label className={OPS_LABEL_CLASS}>
                Prim răspuns (h)
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  className={OPS_INPUT_CLASS}
                  disabled={!canWrite || pending}
                  value={draft.priorities[key].firstResponseHours}
                  onChange={(e) =>
                    setHours(key, "firstResponseHours", Math.max(0, Number(e.target.value) || 0))
                  }
                />
              </label>
              <label className={OPS_LABEL_CLASS}>
                Rezolvare (h)
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  className={OPS_INPUT_CLASS}
                  disabled={!canWrite || pending}
                  value={draft.priorities[key].resolveHours}
                  onChange={(e) =>
                    setHours(key, "resolveHours", Math.max(0, Number(e.target.value) || 0))
                  }
                />
              </label>
            </div>
          ))}
        </div>
      ) : null}

      {canWrite ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void save()}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          {pending ? "Se salvează…" : "Salvează SLA"}
        </button>
      ) : null}
    </div>
  );
}
