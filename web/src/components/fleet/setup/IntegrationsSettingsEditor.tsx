"use client";

import { useState } from "react";
import { fleetJsonHeaders } from "@/lib/fleet-api";
import {
  integrationsSettingsBrowserBase,
  type TenantIntegrationsSettings,
} from "@/lib/integrations-settings";

type Props = {
  initial: TenantIntegrationsSettings;
};

export function IntegrationsSettingsEditor({ initial }: Props) {
  const [settings, setSettings] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function patch(partial: Partial<TenantIntegrationsSettings>) {
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(integrationsSettingsBrowserBase, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(partial),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const next = (await res.json()) as TenantIntegrationsSettings;
      setSettings(next);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setPending(false);
    }
  }

  function toggleProvider(id: string, enabled: boolean) {
    const nextProviders = settings.partsCatalogProviders.map((p) =>
      p.id === id ? { ...p, enabled } : p,
    );
    void patch({ partsCatalogProviders: nextProviders });
  }

  return (
    <div className="max-w-2xl space-y-4">
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-400">Salvat.</p> : null}

      <div className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">Import deviz</h2>
          <p className="mt-1 text-xs text-zinc-500">
            PDF / scan Audatex → preview linii → ciornă pe comandă. Necesită și „Import PDF” în Setup → WO.
          </p>
        </div>

        <label className="flex items-start gap-3 text-sm text-zinc-300">
          <input
            type="checkbox"
            className="mt-1"
            checked={settings.audatexImportEnabled}
            disabled={pending}
            onChange={(e) => void patch({ audatexImportEnabled: e.target.checked })}
          />
          <span>
            <span className="font-medium text-zinc-100">Import PDF / Audatex</span>
            <span className="mt-0.5 block text-xs text-zinc-500">
              Activează OCR + mapare euristică pe WO → Comandă → Import deviz PDF.
            </span>
          </span>
        </label>

        <div className="border-t border-zinc-800 pt-5">
          <h2 className="text-sm font-medium text-zinc-200">Catalog piese</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Conectori pentru lookup / verificare preț (stub — fără API real încă).
          </p>
        </div>

        <label className="flex items-start gap-3 text-sm text-zinc-300">
          <input
            type="checkbox"
            className="mt-1"
            checked={settings.partsCatalogEnabled}
            disabled={pending}
            onChange={(e) => void patch({ partsCatalogEnabled: e.target.checked })}
          />
          <span>
            <span className="font-medium text-zinc-100">Catalog piese activ</span>
            <span className="mt-0.5 block text-xs text-zinc-500">
              Pregătește UI „Verifică preț” pe linii (când și Setup → WO o permite).
            </span>
          </span>
        </label>

        <ul className="space-y-2 pl-1">
          {settings.partsCatalogProviders.map((p) => (
            <li key={p.id}>
              <label className="flex items-center gap-3 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={p.enabled}
                  disabled={pending || !settings.partsCatalogEnabled}
                  onChange={(e) => toggleProvider(p.id, e.target.checked)}
                />
                <span>
                  {p.label}
                  <span className="ml-2 text-xs text-zinc-500">({p.id})</span>
                </span>
              </label>
            </li>
          ))}
        </ul>

        <div className="border-t border-zinc-800 pt-5">
          <h2 className="text-sm font-medium text-zinc-200">Comenzi piese</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Lansare comenzi după aprobare (stub până la conectori).
          </p>
        </div>

        <label className="flex items-start gap-3 text-sm text-zinc-300">
          <input
            type="checkbox"
            className="mt-1"
            checked={settings.partsOrderLaunchEnabled}
            disabled={pending}
            onChange={(e) => void patch({ partsOrderLaunchEnabled: e.target.checked })}
          />
          <span>
            <span className="font-medium text-zinc-100">Lansare comenzi piese</span>
            <span className="mt-0.5 block text-xs text-zinc-500">
              Flag tenant — UI de lansare vine în faza următoare.
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}
