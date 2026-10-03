"use client";

import { useState } from "react";
import { fleetJsonHeaders } from "@/lib/fleet-api";
import {
  DEFAULT_FLEET_SETTINGS,
  type FleetCatalogItem,
  type FleetSettings,
  fleetSettingsBrowserBase,
} from "@/lib/fleet-settings";
import { VEHICLE_GRID_COLUMNS } from "@/lib/vehicle-grid-columns";
import { CatalogRowsEditor, newSlug } from "./CatalogRowsEditor";

type Props = { initial: FleetSettings };

export function FleetSettingsEditor({ initial }: Props) {
  const [settings, setSettings] = useState(initial);
  const [presets, setPresets] = useState(initial.reminderPresets);
  const [docs, setDocs] = useState(initial.documentTypes);
  const [equipment, setEquipment] = useState(initial.equipmentKinds);
  const [cols, setCols] = useState<string[]>(
    initial.defaultVehicleColumnKeys ?? VEHICLE_GRID_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [newPresetLabel, setNewPresetLabel] = useState("");

  async function patch(partial: Partial<FleetSettings>) {
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(fleetSettingsBrowserBase, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(partial),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const next = (await res.json()) as FleetSettings;
      setSettings(next);
      setPresets(next.reminderPresets);
      setDocs(next.documentTypes);
      setEquipment(next.equipmentKinds);
      if (next.defaultVehicleColumnKeys) setCols(next.defaultVehicleColumnKeys);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-400">Salvat.</p> : null}

      <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
        <h2 className="text-sm font-medium text-zinc-200">General</h2>
        <label className="space-y-1 text-sm text-zinc-300">
          <span className="font-medium text-zinc-100">Zile „expiră curând” (documente flotă)</span>
          <input
            type="number"
            min={1}
            className="w-full max-w-[8rem] rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            value={settings.expiringSoonDays}
            disabled={pending}
            onChange={(e) =>
              setSettings((s) => ({ ...s, expiringSoonDays: parseInt(e.target.value, 10) || 1 }))
            }
            onBlur={(e) => {
              const n = parseInt(e.target.value, 10);
              if (Number.isFinite(n) && n >= 1) void patch({ expiringSoonDays: n });
            }}
          />
        </label>
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">Șabloane remindere</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Offset-uri în zile înainte de expirare (0 = ziua expirării). Intervalele reale rămân pe vehicul.
          </p>
        </div>
        <ul className="space-y-3">
          {presets.map((p, idx) => (
            <li key={p.id} className="space-y-2 rounded-lg border border-zinc-800 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={p.enabled}
                    disabled={pending}
                    onChange={(e) => {
                      const next = presets.map((r, i) =>
                        i === idx ? { ...r, enabled: e.target.checked } : r,
                      );
                      setPresets(next);
                    }}
                  />
                  Activ
                </label>
                <code className="text-[11px] text-zinc-500">{p.id}</code>
                {p.system ? (
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">sistem</span>
                ) : (
                  <button
                    type="button"
                    className="text-[11px] text-red-400"
                    disabled={pending}
                    onClick={() => setPresets(presets.filter((_, i) => i !== idx))}
                  >
                    Șterge
                  </button>
                )}
              </div>
              <input
                type="text"
                value={p.label}
                disabled={pending}
                onChange={(e) => {
                  const next = presets.map((r, i) =>
                    i === idx ? { ...r, label: e.target.value } : r,
                  );
                  setPresets(next);
                }}
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
              />
              <input
                type="text"
                value={p.description}
                disabled={pending}
                onChange={(e) => {
                  const next = presets.map((r, i) =>
                    i === idx ? { ...r, description: e.target.value } : r,
                  );
                  setPresets(next);
                }}
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-300"
                placeholder="Descriere"
              />
              <label className="block text-xs text-zinc-500">
                Offset-uri (zile, separate prin virgulă)
                <input
                  type="text"
                  value={p.offsets.join(", ")}
                  disabled={pending}
                  onChange={(e) => {
                    const offsets = e.target.value
                      .split(/[,\s]+/)
                      .map((x) => parseInt(x, 10))
                      .filter((n) => Number.isFinite(n) && n >= 0);
                    const next = presets.map((r, i) =>
                      i === idx ? { ...r, offsets: [...new Set(offsets)].sort((a, b) => b - a) } : r,
                    );
                    setPresets(next);
                  }}
                  className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono text-sm"
                />
              </label>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={newPresetLabel}
            disabled={pending}
            placeholder="Șablon nou"
            onChange={(e) => setNewPresetLabel(e.target.value)}
            className="min-w-[10rem] flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            disabled={pending || !newPresetLabel.trim()}
            onClick={() => {
              const label = newPresetLabel.trim();
              let id = newSlug(label);
              const ids = new Set(presets.map((p) => p.id));
              if (ids.has(id)) id = `${id}_${Date.now().toString(36).slice(-4)}`;
              setPresets([
                ...presets,
                {
                  id,
                  label,
                  description: "",
                  offsets: [30, 7],
                  enabled: true,
                  system: false,
                },
              ]);
              setNewPresetLabel("");
            }}
            className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-200 disabled:opacity-50"
          >
            Adaugă
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void patch({ reminderPresets: presets })}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            Salvează remindere
          </button>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">Tipuri document flotă</h2>
        </div>
        <CatalogRowsEditor<FleetCatalogItem>
          rows={docs}
          pending={pending}
          onChange={setDocs}
          makeRow={(code, label) => ({ code, label, enabled: true, system: false })}
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => void patch({ documentTypes: docs })}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          Salvează tipuri document
        </button>
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">Tipuri echipamente</h2>
        </div>
        <CatalogRowsEditor<FleetCatalogItem>
          rows={equipment}
          pending={pending}
          onChange={setEquipment}
          makeRow={(code, label) => ({ code, label, enabled: true, system: false })}
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => void patch({ equipmentKinds: equipment })}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          Salvează echipamente
        </button>
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">Coloane default — listă vehicule</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Vizibile implicit pentru utilizatori noi (browserul poate override local).
          </p>
        </div>
        <ul className="space-y-1">
          {VEHICLE_GRID_COLUMNS.map((c) => (
            <li key={c.key}>
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={cols.includes(c.key)}
                  disabled={pending}
                  onChange={(e) => {
                    setCols((prev) =>
                      e.target.checked
                        ? [...prev, c.key]
                        : prev.filter((k) => k !== c.key),
                    );
                  }}
                />
                {c.label}
              </label>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => void patch({ defaultVehicleColumnKeys: cols })}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            Salvează coloane
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void patch({ defaultVehicleColumnKeys: null })}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300"
          >
            Reset la default cod
          </button>
        </div>
      </section>
    </div>
  );
}
