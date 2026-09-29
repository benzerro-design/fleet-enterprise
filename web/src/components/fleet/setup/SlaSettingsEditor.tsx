"use client";

import { useEffect, useState } from "react";
import { OPS_INPUT_CLASS } from "@/components/fleet/ops-form-primitives";
import { fleetJsonHeaders } from "@/lib/fleet-api";

type PriorityKey = "urgent" | "high" | "normal" | "low";

type SlaPriorityHours = {
  firstResponseHours: number;
  resolveHours: number;
};

type TenantSlaSettings = {
  enabled: boolean;
  autoPrioritizeFromType: boolean;
  priorities: Record<PriorityKey, SlaPriorityHours>;
};

const LABELS: Record<PriorityKey, string> = {
  urgent: "Urgentă",
  high: "Ridicată",
  normal: "Normală",
  low: "Scăzută",
};

const DEFAULTS: TenantSlaSettings = {
  enabled: true,
  autoPrioritizeFromType: true,
  priorities: {
    urgent: { firstResponseHours: 1, resolveHours: 8 },
    high: { firstResponseHours: 4, resolveHours: 24 },
    normal: { firstResponseHours: 8, resolveHours: 72 },
    low: { firstResponseHours: 24, resolveHours: 120 },
  },
};

/** CRM-010 / SETUP-004 — Configurează timer-e SLA pe prioritate. */
export function SlaSettingsEditor() {
  const [settings, setSettings] = useState<TenantSlaSettings>(DEFAULTS);
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
        const data = (await res.json()) as TenantSlaSettings;
        if (!cancelled) setSettings(data);
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
      const data = (await res.json()) as TenantSlaSettings;
      setSettings(data);
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-zinc-200">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => setSettings((s) => ({ ...s, enabled: e.target.checked }))}
          />
          SLA activ (calcul termene la creare / schimbare prioritate)
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-200">
          <input
            type="checkbox"
            checked={settings.autoPrioritizeFromType}
            onChange={(e) =>
              setSettings((s) => ({ ...s, autoPrioritizeFromType: e.target.checked }))
            }
          />
          Auto-prioritate din tip tichet (daună→urgent, tehnic→high…)
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-900/80 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-3 py-2">Prioritate</th>
              <th className="px-3 py-2">Prim răspuns (ore)</th>
              <th className="px-3 py-2">Rezolvare (ore)</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(LABELS) as PriorityKey[]).map((key) => (
              <tr key={key} className="border-t border-zinc-800">
                <td className="px-3 py-2 text-zinc-200">{LABELS[key]}</td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    step={0.5}
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
                    className={`${OPS_INPUT_CLASS} w-28`}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    step={0.5}
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
                    className={`${OPS_INPUT_CLASS} w-28`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
