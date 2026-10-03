"use client";

import { useEffect, useState } from "react";
import { OPS_INPUT_CLASS } from "@/components/fleet/ops-form-primitives";
import { fleetJsonHeaders } from "@/lib/fleet-api";
import {
  DEFAULT_SLA_SETTINGS,
  PRIORITY_LABELS,
  TICKET_TYPE_LABELS,
  TICKET_TYPES_FOR_SLA,
  normalizeSlaSettings,
  type PriorityKey,
  type TenantSlaSettings,
} from "@/lib/sla-settings";

const PRIORITY_KEYS = Object.keys(PRIORITY_LABELS) as PriorityKey[];

/** CRM-010 / SETUP-004 — timer-e SLA pe prioritate + mapare tip → prioritate (tenant). */
export function SlaSettingsEditor() {
  const [settings, setSettings] = useState<TenantSlaSettings>(DEFAULT_SLA_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/tenant/sla-settings", {
          headers: fleetJsonHeaders(),
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Partial<TenantSlaSettings>;
        if (!cancelled) setSettings(normalizeSlaSettings(data));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Încărcare eșuată");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/tenant/sla-settings", {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as Partial<TenantSlaSettings>;
      setSettings(normalizeSlaSettings(data));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvare eșuată");
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Se încarcă setările SLA…</p>;
  }

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">General</h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Se aplică la crearea tichetelor și la schimbarea priorității. Override pe un client: fișa
            Clientului → tab SLA.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-6">
          <label className="flex items-start gap-2.5 text-sm text-zinc-200">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={settings.enabled}
              onChange={(e) => setSettings((s) => ({ ...s, enabled: e.target.checked }))}
            />
            <span>
              <span className="font-medium">SLA activ</span>
              <span className="block text-xs text-zinc-500">
                Calculează termene de răspuns și rezolvare pe tichet.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2.5 text-sm text-zinc-200">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={settings.autoPrioritizeFromType}
              onChange={(e) =>
                setSettings((s) => ({ ...s, autoPrioritizeFromType: e.target.checked }))
              }
            />
            <span>
              <span className="font-medium">Auto-prioritate din tip</span>
              <span className="block text-xs text-zinc-500">
                Dacă prioritatea lipsește la creare, o ia din tabelul tip → prioritate de mai jos.
              </span>
            </span>
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">Termene pe prioritate</h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Ore până la primul răspuns și până la rezolvare, pe fiecare prioritate.
          </p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-900/50 text-[11px] uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2.5 font-medium">Prioritate</th>
                <th className="px-3 py-2.5 font-medium">Prim răspuns (ore)</th>
                <th className="px-3 py-2.5 font-medium">Rezolvare (ore)</th>
              </tr>
            </thead>
            <tbody>
              {PRIORITY_KEYS.map((key) => (
                <tr key={key} className="border-t border-zinc-800/80">
                  <td className="px-3 py-2.5 text-zinc-200">{PRIORITY_LABELS[key]}</td>
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      disabled={!settings.enabled}
                      value={settings.priorities[key].firstResponseHours}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setSettings((s) => ({
                          ...s,
                          priorities: {
                            ...s.priorities,
                            [key]: { ...s.priorities[key], firstResponseHours: v },
                          },
                        }));
                      }}
                      className={`${OPS_INPUT_CLASS} w-28 disabled:opacity-50`}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      disabled={!settings.enabled}
                      value={settings.priorities[key].resolveHours}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setSettings((s) => ({
                          ...s,
                          priorities: {
                            ...s.priorities,
                            [key]: { ...s.priorities[key], resolveHours: v },
                          },
                        }));
                      }}
                      className={`${OPS_INPUT_CLASS} w-28 disabled:opacity-50`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">Tip tichet → prioritate</h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Folosit doar când „Auto-prioritate din tip” e activ și la creare nu e trimisă o prioritate
            explicită.
          </p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-900/50 text-[11px] uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2.5 font-medium">Tip tichet</th>
                <th className="px-3 py-2.5 font-medium">Prioritate implicită</th>
              </tr>
            </thead>
            <tbody>
              {TICKET_TYPES_FOR_SLA.map((type) => (
                <tr key={type} className="border-t border-zinc-800/80">
                  <td className="px-3 py-2.5 text-zinc-200">{TICKET_TYPE_LABELS[type]}</td>
                  <td className="px-3 py-2.5">
                    <select
                      disabled={!settings.autoPrioritizeFromType}
                      value={settings.priorityByType[type]}
                      onChange={(e) => {
                        const value = e.target.value as PriorityKey;
                        setSettings((s) => ({
                          ...s,
                          priorityByType: {
                            ...s.priorityByType,
                            [type]: value,
                          },
                        }));
                      }}
                      className={`${OPS_INPUT_CLASS} w-44 disabled:opacity-50`}
                    >
                      {PRIORITY_KEYS.map((p) => (
                        <option key={p} value={p}>
                          {PRIORITY_LABELS[p]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-400">Salvat.</p> : null}

      <button
        type="button"
        disabled={pending}
        onClick={() => void save()}
        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
      >
        {pending ? "Se salvează…" : "Salvează SLA"}
      </button>
    </div>
  );
}
