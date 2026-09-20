"use client";

import { useEffect, useState } from "react";
import { useAppearancePrefs } from "@/components/fleet/AppearanceProvider";
import type {
  AppearanceDateFormat,
  AppearanceDensity,
  AppearanceTheme,
} from "@/lib/appearance-prefs";
import {
  readAppointmentProposalHistoryTabs,
  writeAppointmentProposalHistoryTabs,
} from "@/lib/appointment-proposal-history-prefs";
import { OPS_LABEL_CLASS } from "@/components/fleet/ops-form-primitives";

const THEME_OPTIONS: { value: AppearanceTheme; label: string; hint: string }[] = [
  { value: "dark", label: "Întunecat", hint: "Implicit — zinc pe fundal închis" },
  { value: "light", label: "Luminos", hint: "Fundal deschis — liste și formulare" },
  { value: "system", label: "Sistem", hint: "Urmează OS-ul" },
];

const DENSITY_OPTIONS: { value: AppearanceDensity; label: string; hint: string }[] = [
  { value: "comfortable", label: "Comfortabil", hint: "Mai mult spațiu — formulare, lectură" },
  { value: "compact", label: "Compact", hint: "Liste dense — ca Shopify admin" },
];

const DATE_OPTIONS: { value: AppearanceDateFormat; label: string; example: string }[] = [
  { value: "ro", label: "Română (scurt)", example: "20 sept. 2026" },
  { value: "numeric", label: "Numeric RO", example: "20.09.2026" },
  { value: "iso", label: "ISO", example: "2026-09-20" },
];

export function AppearancePreferencesForm() {
  const { prefs, hydrated, update } = useAppearancePrefs();
  const [historyTabs, setHistoryTabs] = useState(false);

  useEffect(() => {
    setHistoryTabs(readAppointmentProposalHistoryTabs());
  }, []);

  return (
    <div className="space-y-8">
      {!hydrated ? (
        <p className="text-sm text-zinc-500">Se încarcă preferințele…</p>
      ) : null}

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Temă</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Se aplică imediat pe tot UI-ul din acest browser — preferință personală, nu setare tenant.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {THEME_OPTIONS.map((opt) => {
            const active = prefs.theme === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={!hydrated}
                onClick={() => update({ theme: opt.value })}
                className={`rounded-lg border px-3 py-2.5 text-left transition-colors disabled:opacity-50 ${
                  active
                    ? "border-emerald-500/50 bg-emerald-950/30 text-emerald-100"
                    : "border-zinc-800 bg-zinc-950/40 text-zinc-300 hover:bg-zinc-900"
                }`}
              >
                <span className="block text-sm font-medium">{opt.label}</span>
                <span className="mt-0.5 block text-[11px] text-zinc-500">{opt.hint}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Densitate</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Compact aliniază și listele (simplu). Comfortabil = detaliat.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {DENSITY_OPTIONS.map((opt) => {
            const active = prefs.density === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={!hydrated}
                onClick={() => update({ density: opt.value })}
                className={`rounded-lg border px-3 py-2.5 text-left transition-colors disabled:opacity-50 ${
                  active
                    ? "border-sky-500/50 bg-sky-950/30 text-sky-100"
                    : "border-zinc-800 bg-zinc-950/40 text-zinc-300 hover:bg-zinc-900"
                }`}
              >
                <span className="block text-sm font-medium">{opt.label}</span>
                <span className="mt-0.5 block text-[11px] text-zinc-500">{opt.hint}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Mișcare</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Reduce animațiile și tranzițiile.</p>
        </div>
        <label className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2.5 text-sm text-zinc-200">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={prefs.reduceMotion}
            disabled={!hydrated}
            onChange={(e) => update({ reduceMotion: e.target.checked })}
          />
          <span>
            <span className="font-medium">Reduce motion</span>
            <span className="mt-0.5 block text-xs text-zinc-500">
              Respectă accesibilitatea — utile pe dispozitive lente sau la sensibilitate la mișcare.
            </span>
          </span>
        </label>
      </section>

      <section className="space-y-3">
        <div>
          <label className={OPS_LABEL_CLASS}>Format dată (afișare)</label>
          <p className="mt-0.5 text-xs text-zinc-500">
            Liste și detalii pe client. Formularele datetime-local rămân neschimbate.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {DATE_OPTIONS.map((opt) => {
            const active = prefs.dateFormat === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={!hydrated}
                onClick={() => update({ dateFormat: opt.value })}
                className={`rounded-lg border px-3 py-2.5 text-left transition-colors disabled:opacity-50 ${
                  active
                    ? "border-amber-500/50 bg-amber-950/30 text-amber-100"
                    : "border-zinc-800 bg-zinc-950/40 text-zinc-300 hover:bg-zinc-900"
                }`}
              >
                <span className="block text-sm font-medium">{opt.label}</span>
                <span className="mt-0.5 block font-mono text-[11px] text-zinc-500">{opt.example}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Programări (experimental)</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Tab-uri Curente / Istoric pe PROGRAMĂRI (manager și admin). Implicit oprit — dacă nu-ți place,
            debifează și revii la UI-ul actual.
          </p>
        </div>
        <label className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2.5 text-sm text-zinc-200">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={historyTabs}
            onChange={(e) => {
              const on = e.target.checked;
              setHistoryTabs(on);
              writeAppointmentProposalHistoryTabs(on);
            }}
          />
          <span>
            <span className="font-medium">Istoric propuneri pe tichet</span>
            <span className="mt-0.5 block text-xs text-zinc-500">
              Nu apare pentru șofer. Furnizor (inspector) = Slice B, separat.
            </span>
          </span>
        </label>
      </section>
    </div>
  );
}
