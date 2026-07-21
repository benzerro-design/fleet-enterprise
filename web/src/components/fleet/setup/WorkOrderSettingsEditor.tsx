"use client";

import { useState } from "react";
import { fleetJsonHeaders } from "@/lib/fleet-api";
import {
  type WorkOrderSettings,
  workOrderSettingsBrowserBase,
} from "@/lib/work-order-settings";

type Props = {
  initial: WorkOrderSettings;
};

export function WorkOrderSettingsEditor({ initial }: Props) {
  const [settings, setSettings] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function patch(partial: Partial<WorkOrderSettings>) {
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(workOrderSettingsBrowserBase, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(partial),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const next = (await res.json()) as WorkOrderSettings;
      setSettings(next);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setPending(false);
    }
  }

  function patchNumber(key: keyof WorkOrderSettings, value: string) {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n) || n < 0) return;
    void patch({ [key]: n } as Partial<WorkOrderSettings>);
  }

  return (
    <div className="max-w-xl space-y-6 rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
      <div>
        <h2 className="text-sm font-medium text-zinc-200">Recepție & odometru</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Controlează marcarea In/Out service pe comenzi (inclusiv portal partener).
        </p>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-400">Salvat.</p> : null}

      <label className="flex items-start gap-3 text-sm text-zinc-300">
        <input
          type="checkbox"
          className="mt-1"
          checked={settings.requireServiceKm}
          disabled={pending}
          onChange={(e) => void patch({ requireServiceKm: e.target.checked })}
        />
        <span>
          <span className="font-medium text-zinc-100">Obligativitate km in și km out</span>
          <span className="mt-0.5 block text-xs text-zinc-500">
            Da = nu se poate marca In/Out service fără km completat.
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3 text-sm text-zinc-300">
        <input
          type="checkbox"
          className="mt-1"
          checked={settings.updateFleetOdometerFromServiceKm}
          disabled={pending}
          onChange={(e) => void patch({ updateFleetOdometerFromServiceKm: e.target.checked })}
        />
        <span>
          <span className="font-medium text-zinc-100">Km in / km out modifică odometrul flotă</span>
          <span className="mt-0.5 block text-xs text-zinc-500">
            Da = actualizează odometrul vehiculului doar dacă noul km ≥ km curent (citire ops pe comandă).
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3 text-sm text-zinc-300">
        <input
          type="checkbox"
          className="mt-1"
          checked={settings.requirePartCode}
          disabled={pending}
          onChange={(e) => void patch({ requirePartCode: e.target.checked })}
        />
        <span>
          <span className="font-medium text-zinc-100">Cod piesă obligatoriu în deviz</span>
          <span className="mt-0.5 block text-xs text-zinc-500">
            Da = liniile de tip piese au nevoie de cod, cu excepția marcajului explicit „fără cod”.
          </span>
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="space-y-1 text-sm text-zinc-300">
          <span className="font-medium text-zinc-100">Garanție piese (luni)</span>
          <input
            type="number"
            min={0}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            value={settings.defaultPartsWarrantyMonths}
            disabled={pending}
            onChange={(e) =>
              setSettings((s) => ({ ...s, defaultPartsWarrantyMonths: parseInt(e.target.value, 10) || 0 }))
            }
            onBlur={(e) => patchNumber("defaultPartsWarrantyMonths", e.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm text-zinc-300">
          <span className="font-medium text-zinc-100">Garanție piese (km)</span>
          <input
            type="number"
            min={0}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            value={settings.defaultPartsWarrantyKm}
            disabled={pending}
            onChange={(e) => setSettings((s) => ({ ...s, defaultPartsWarrantyKm: parseInt(e.target.value, 10) || 0 }))}
            onBlur={(e) => patchNumber("defaultPartsWarrantyKm", e.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm text-zinc-300">
          <span className="font-medium text-zinc-100">Garanție manoperă (luni)</span>
          <input
            type="number"
            min={0}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            value={settings.defaultLaborWarrantyMonths}
            disabled={pending}
            onChange={(e) =>
              setSettings((s) => ({ ...s, defaultLaborWarrantyMonths: parseInt(e.target.value, 10) || 0 }))
            }
            onBlur={(e) => patchNumber("defaultLaborWarrantyMonths", e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}
