"use client";

import { useState } from "react";
import { fleetJsonHeaders } from "@/lib/fleet-api";
import {
  DEFAULT_IMPORT_SETTINGS,
  type ImportEntitySetting,
  type ImportSettings,
  type ImportTemplateSetting,
  importSettingsBrowserBase,
} from "@/lib/import-settings";
import { CatalogRowsEditor, newSlug } from "./CatalogRowsEditor";

type Props = { initial: ImportSettings };

export function ImportSettingsEditor({ initial }: Props) {
  const [settings, setSettings] = useState(initial);
  const [entities, setEntities] = useState(initial.entities);
  const [templates, setTemplates] = useState(initial.templates);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [newTplName, setNewTplName] = useState("");
  const [newTplEntity, setNewTplEntity] = useState("vehicles");
  const [newTplCols, setNewTplCols] = useState("");

  async function patch(partial: Partial<ImportSettings>) {
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(importSettingsBrowserBase, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(partial),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const next = (await res.json()) as ImportSettings;
      setSettings(next);
      setEntities(next.entities);
      setTemplates(next.templates);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setPending(false);
    }
  }

  function downloadTemplate(t: ImportTemplateSetting) {
    const header = t.columns.join(",");
    const blob = new Blob([`${header}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${t.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-2xl space-y-6">
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-400">Salvat.</p> : null}

      <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">Drepturi & reguli</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Motorul de import CSV se leagă pe aceste setări. Conectorii API (Audatex, catalog) rămân în
            Integrări.
          </p>
        </div>
        <label className="flex items-start gap-3 text-sm text-zinc-300">
          <input
            type="checkbox"
            className="mt-1"
            checked={settings.allowTenantAdminImport}
            disabled={pending}
            onChange={(e) => void patch({ allowTenantAdminImport: e.target.checked })}
          />
          <span className="font-medium text-zinc-100">L★ (tenant admin) poate importa în masă</span>
        </label>
        <label className="flex items-start gap-3 text-sm text-zinc-300">
          <input
            type="checkbox"
            className="mt-1"
            checked={settings.allowClientAdminImport}
            disabled={pending}
            onChange={(e) => void patch({ allowClientAdminImport: e.target.checked })}
          />
          <span className="font-medium text-zinc-100">L1 (client admin) poate importa în masă</span>
        </label>
        <label className="flex items-start gap-3 text-sm text-zinc-300">
          <input
            type="checkbox"
            className="mt-1"
            checked={settings.requireDryRun}
            disabled={pending}
            onChange={(e) => void patch({ requireDryRun: e.target.checked })}
          />
          <span>
            <span className="font-medium text-zinc-100">Dry-run obligatoriu</span>
            <span className="mt-0.5 block text-xs text-zinc-500">
              Previzualizare erori înainte de scriere în DB.
            </span>
          </span>
        </label>
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">Entități importabile</h2>
        </div>
        <CatalogRowsEditor<ImportEntitySetting>
          rows={entities}
          pending={pending}
          onChange={setEntities}
          makeRow={(code, label) => ({ code, label, enabled: true, system: false })}
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => void patch({ entities })}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          Salvează entități
        </button>
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">Șabloane CSV</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Descarcă header-ul CSV. Adaugă mapări proprii pe entitate.
          </p>
        </div>
        <ul className="space-y-3">
          {templates.map((t, idx) => (
            <li key={t.id} className="space-y-2 rounded-lg border border-zinc-800 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={t.enabled}
                    disabled={pending}
                    onChange={(e) => {
                      const next = templates.map((r, i) =>
                        i === idx ? { ...r, enabled: e.target.checked } : r,
                      );
                      setTemplates(next);
                    }}
                  />
                  Activ
                </label>
                <code className="text-[11px] text-zinc-500">
                  {t.id} · {t.entity}
                </code>
                {t.system ? (
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">sistem</span>
                ) : (
                  <button
                    type="button"
                    className="text-[11px] text-red-400"
                    disabled={pending}
                    onClick={() => setTemplates(templates.filter((_, i) => i !== idx))}
                  >
                    Șterge
                  </button>
                )}
                <button
                  type="button"
                  className="ml-auto text-[11px] text-violet-300 hover:text-violet-200"
                  onClick={() => downloadTemplate(t)}
                >
                  Download CSV
                </button>
              </div>
              <input
                type="text"
                value={t.name}
                disabled={pending}
                onChange={(e) => {
                  const next = templates.map((r, i) =>
                    i === idx ? { ...r, name: e.target.value } : r,
                  );
                  setTemplates(next);
                }}
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
              />
              <label className="block text-xs text-zinc-500">
                Coloane (virgule)
                <input
                  type="text"
                  value={t.columns.join(", ")}
                  disabled={pending}
                  onChange={(e) => {
                    const columns = e.target.value
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean);
                    const next = templates.map((r, i) =>
                      i === idx ? { ...r, columns } : r,
                    );
                    setTemplates(next);
                  }}
                  className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono text-xs"
                />
              </label>
            </li>
          ))}
        </ul>
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            type="text"
            value={newTplName}
            disabled={pending}
            placeholder="Nume șablon"
            onChange={(e) => setNewTplName(e.target.value)}
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm sm:col-span-1"
          />
          <select
            value={newTplEntity}
            disabled={pending}
            onChange={(e) => setNewTplEntity(e.target.value)}
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
          >
            {entities.filter((e) => e.enabled).map((e) => (
              <option key={e.code} value={e.code}>
                {e.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={newTplCols}
            disabled={pending}
            placeholder="col1, col2, col3"
            onChange={(e) => setNewTplCols(e.target.value)}
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono text-xs sm:col-span-3"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending || !newTplName.trim() || !newTplCols.trim()}
            onClick={() => {
              const name = newTplName.trim();
              let id = newSlug(name);
              const ids = new Set(templates.map((t) => t.id));
              if (ids.has(id)) id = `${id}_${Date.now().toString(36).slice(-4)}`;
              const columns = newTplCols
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean);
              setTemplates([
                ...templates,
                {
                  id,
                  entity: newTplEntity,
                  name,
                  columns,
                  enabled: true,
                  system: false,
                },
              ]);
              setNewTplName("");
              setNewTplCols("");
            }}
            className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-200 disabled:opacity-50"
          >
            Adaugă șablon
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void patch({ templates })}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            Salvează șabloane
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const reset = DEFAULT_IMPORT_SETTINGS.templates.map((t) => ({
                ...t,
                columns: [...t.columns],
              }));
              setTemplates(reset);
              void patch({ templates: reset });
            }}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300"
          >
            Reset șabloane
          </button>
        </div>
      </section>
    </div>
  );
}
