"use client";

import { useState } from "react";
import { fleetJsonHeaders } from "@/lib/fleet-api";
import {
  DEFAULT_SUPPLIER_SETTINGS,
  type CatalogItem,
  type OnboardingDocKindSetting,
  type SupplierSettings,
  supplierSettingsBrowserBase,
} from "@/lib/supplier-settings";
import { CatalogRowsEditor } from "./CatalogRowsEditor";

type Props = { initial: SupplierSettings };

export function SupplierSettingsEditor({ initial }: Props) {
  const [settings, setSettings] = useState(initial);
  const [docs, setDocs] = useState(initial.onboardingDocKinds);
  const [cats, setCats] = useState(initial.categories);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function patch(partial: Partial<SupplierSettings>) {
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(supplierSettingsBrowserBase, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(partial),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const next = (await res.json()) as SupplierSettings;
      setSettings(next);
      setDocs(next.onboardingDocKinds);
      setCats(next.categories);
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

      <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">Compliance comenzi</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Când se blochează acceptarea / alocarea WO pe baza documentelor furnizorului.
          </p>
        </div>
        <label className="flex items-start gap-3 text-sm text-zinc-300">
          <input
            type="checkbox"
            className="mt-1"
            checked={settings.blockOrdersOnExpiredRequiredDocs}
            disabled={pending}
            onChange={(e) => void patch({ blockOrdersOnExpiredRequiredDocs: e.target.checked })}
          />
          <span>
            <span className="font-medium text-zinc-100">Blochează la documente obligatorii expirate</span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm text-zinc-300">
          <input
            type="checkbox"
            className="mt-1"
            checked={settings.blockOrdersOnMissingRequiredKinds}
            disabled={pending}
            onChange={(e) => void patch({ blockOrdersOnMissingRequiredKinds: e.target.checked })}
          />
          <span>
            <span className="font-medium text-zinc-100">Blochează dacă lipsesc tipuri obligatorii</span>
            <span className="mt-0.5 block text-xs text-zinc-500">
              Tipurile cu „Obligatoriu default” + Activ trebuie să existe pe fișa furnizorului.
            </span>
          </span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm text-zinc-300">
            <span className="font-medium text-zinc-100">Zile „expiră curând”</span>
            <input
              type="number"
              min={1}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
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
          <label className="space-y-1 text-sm text-zinc-300">
            <span className="font-medium text-zinc-100">Slot capacity implicit</span>
            <input
              type="number"
              min={1}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              value={settings.defaultSlotCapacity}
              disabled={pending}
              onChange={(e) =>
                setSettings((s) => ({ ...s, defaultSlotCapacity: parseInt(e.target.value, 10) || 1 }))
              }
              onBlur={(e) => {
                const n = parseInt(e.target.value, 10);
                if (Number.isFinite(n) && n >= 1) void patch({ defaultSlotCapacity: n });
              }}
            />
          </label>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">Documente onboarding</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Adaugă / redenumește / reordonează tipuri. Sistem = nu se șterg.
          </p>
        </div>
        <CatalogRowsEditor<OnboardingDocKindSetting>
          rows={docs}
          pending={pending}
          onChange={setDocs}
          makeRow={(code, label) => ({
            code,
            label,
            enabled: true,
            system: false,
            requiredByDefault: false,
          })}
          extra={(row, idx) => (
            <label className="flex items-center gap-2 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={row.requiredByDefault}
                disabled={pending}
                onChange={(e) => {
                  const next = docs.map((r, i) =>
                    i === idx ? { ...r, requiredByDefault: e.target.checked } : r,
                  );
                  setDocs(next);
                }}
              />
              Obligatoriu default
            </label>
          )}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => void patch({ onboardingDocKinds: docs })}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Salvează documente
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const reset = DEFAULT_SUPPLIER_SETTINGS.onboardingDocKinds.map((s) => ({ ...s }));
              setDocs(reset);
              void patch({ onboardingDocKinds: reset });
            }}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300"
          >
            Reset
          </button>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">Categorii furnizor</h2>
          <p className="mt-1 text-xs text-zinc-500">Etichete, activ/inactiv, categorii custom.</p>
        </div>
        <CatalogRowsEditor<CatalogItem>
          rows={cats}
          pending={pending}
          onChange={setCats}
          makeRow={(code, label) => ({ code, label, enabled: true, system: false })}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => void patch({ categories: cats })}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Salvează categorii
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const reset = DEFAULT_SUPPLIER_SETTINGS.categories.map((s) => ({ ...s }));
              setCats(reset);
              void patch({ categories: reset });
            }}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300"
          >
            Reset
          </button>
        </div>
      </section>
    </div>
  );
}
