"use client";

import type { ReactNode } from "react";
import { useAppearancePrefs } from "@/components/fleet/AppearanceProvider";
import type {
  AppearanceDateFormat,
  AppearanceDensity,
  AppearanceProfileNav,
  AppearanceTheme,
} from "@/lib/appearance-prefs";
import type { Locale } from "@/lib/i18n/types";
import { useT } from "@/lib/i18n/useT";
import { OPS_LABEL_CLASS } from "@/components/fleet/ops-form-primitives";

const LOCALE_OPTIONS: { value: Locale; labelKey: string }[] = [
  { value: "ro", labelKey: "appearance.locale.ro" },
  { value: "en", labelKey: "appearance.locale.en" },
];

const THEME_OPTIONS: { value: AppearanceTheme; labelKey: string; hintKey: string }[] = [
  { value: "dark", labelKey: "appearance.theme.dark", hintKey: "appearance.theme.darkHint" },
  { value: "light", labelKey: "appearance.theme.light", hintKey: "appearance.theme.lightHint" },
  { value: "system", labelKey: "appearance.theme.system", hintKey: "appearance.theme.systemHint" },
];

const DENSITY_OPTIONS: { value: AppearanceDensity; labelKey: string; hintKey: string }[] = [
  { value: "comfortable", labelKey: "appearance.density.comfortable", hintKey: "appearance.density.comfortableHint" },
  { value: "compact", labelKey: "appearance.density.compact", hintKey: "appearance.density.compactHint" },
];

const DATE_OPTIONS: { value: AppearanceDateFormat; labelKey: string; example: string }[] = [
  { value: "ro", labelKey: "appearance.date.ro", example: "20 sept. 2026" },
  { value: "numeric", labelKey: "appearance.date.numeric", example: "20.09.2026" },
  { value: "iso", labelKey: "appearance.date.iso", example: "2026-09-20" },
];

const PROFILE_NAV_OPTIONS: {
  value: AppearanceProfileNav;
  labelKey: string;
  hintKey: string;
}[] = [
  {
    value: "classic",
    labelKey: "appearance.profileNav.classic",
    hintKey: "appearance.profileNav.classicHint",
  },
  {
    value: "segmented",
    labelKey: "appearance.profileNav.segmented",
    hintKey: "appearance.profileNav.segmentedHint",
  },
];

function ChoiceButton({
  active,
  disabled,
  onClick,
  accent,
  title,
  hint,
  preview,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  accent: "violet" | "emerald" | "sky" | "amber";
  title: string;
  hint?: string;
  preview?: ReactNode;
}) {
  const activeCls =
    accent === "violet"
      ? "border-violet-500/50 bg-violet-950/30 text-violet-100"
      : accent === "emerald"
        ? "border-emerald-500/50 bg-emerald-950/30 text-emerald-100"
        : accent === "sky"
          ? "border-sky-500/50 bg-sky-950/30 text-sky-100"
          : "border-amber-500/50 bg-amber-950/30 text-amber-100";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg border px-3 py-2.5 text-left transition-colors disabled:opacity-50 ${
        active ? activeCls : "border-zinc-800 bg-zinc-950/40 text-zinc-300 hover:bg-zinc-900"
      }`}
    >
      {preview ? (
        <div className="mb-2.5 rounded-md border border-zinc-800/80 bg-zinc-950/70 p-2" aria-hidden>
          {preview}
        </div>
      ) : null}
      <span className="block text-sm font-medium">{title}</span>
      {hint ? <span className="mt-0.5 block text-[11px] text-zinc-500">{hint}</span> : null}
    </button>
  );
}

/** Mini chrome preview — mirrors VehicleProfileTabs classic vs segmented. */
function ProfileNavPreview({ variant }: { variant: AppearanceProfileNav }) {
  const labels = ["Infos", "Photos", "Wheels"];
  if (variant === "segmented") {
    return (
      <div className="flex gap-0.5 rounded-lg bg-zinc-800/70 p-0.5">
        {labels.map((label, i) => (
          <span
            key={label}
            className={
              i === 0
                ? "rounded-md bg-zinc-900 px-2 py-1 text-[9px] font-medium text-emerald-300 shadow-sm ring-1 ring-zinc-700/80"
                : "rounded-md px-2 py-1 text-[9px] text-zinc-500"
            }
          >
            {label}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className="border-b border-zinc-800">
      <div className="flex gap-1">
        {labels.map((label, i) => (
          <span
            key={label}
            className={
              i === 0
                ? "-mb-px rounded-t-md border border-zinc-700 border-b-zinc-950 bg-zinc-900 px-2 py-1 text-[9px] font-medium text-emerald-300"
                : "rounded-t-md border border-transparent px-2 py-1 text-[9px] text-zinc-500"
            }
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Preferințe personale: limbă, temă, densitate, mișcare, dată. */
export function PersonalPreferencesForm() {
  const { prefs, hydrated, update } = useAppearancePrefs();
  const tx = useT();

  return (
    <div className="space-y-8">
      {!hydrated ? (
        <p className="text-sm text-zinc-500">{tx("appearance.loading")}</p>
      ) : null}

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">{tx("appearance.locale.title")}</h2>
          <p className="mt-0.5 text-xs text-zinc-500">{tx("appearance.locale.description")}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {LOCALE_OPTIONS.map((opt) => (
            <ChoiceButton
              key={opt.value}
              active={prefs.locale === opt.value}
              disabled={!hydrated}
              onClick={() => update({ locale: opt.value })}
              accent="violet"
              title={tx(opt.labelKey)}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">{tx("appearance.theme.title")}</h2>
          <p className="mt-0.5 text-xs text-zinc-500">{tx("appearance.theme.description")}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {THEME_OPTIONS.map((opt) => (
            <ChoiceButton
              key={opt.value}
              active={prefs.theme === opt.value}
              disabled={!hydrated}
              onClick={() => update({ theme: opt.value })}
              accent="emerald"
              title={tx(opt.labelKey)}
              hint={tx(opt.hintKey)}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">{tx("appearance.density.title")}</h2>
          <p className="mt-0.5 text-xs text-zinc-500">{tx("appearance.density.description")}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {DENSITY_OPTIONS.map((opt) => (
            <ChoiceButton
              key={opt.value}
              active={prefs.density === opt.value}
              disabled={!hydrated}
              onClick={() => update({ density: opt.value })}
              accent="sky"
              title={tx(opt.labelKey)}
              hint={tx(opt.hintKey)}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">{tx("appearance.motion.title")}</h2>
          <p className="mt-0.5 text-xs text-zinc-500">{tx("appearance.motion.description")}</p>
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
            <span className="font-medium">{tx("appearance.motion.reduce")}</span>
            <span className="mt-0.5 block text-xs text-zinc-500">{tx("appearance.motion.hint")}</span>
          </span>
        </label>
      </section>

      <section className="space-y-3">
        <div>
          <label className={OPS_LABEL_CLASS}>{tx("appearance.date.title")}</label>
          <p className="mt-0.5 text-xs text-zinc-500">{tx("appearance.date.description")}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {DATE_OPTIONS.map((opt) => (
            <ChoiceButton
              key={opt.value}
              active={prefs.dateFormat === opt.value}
              disabled={!hydrated}
              onClick={() => update({ dateFormat: opt.value })}
              accent="amber"
              title={tx(opt.labelKey)}
              hint={opt.example}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

/**
 * Design UI: pattern-uri de chrome curate (taburi, etc.).
 * Nu e branding tenant și nu e editor liber — adăugăm iteme când ne lovim de ele.
 */
export function DesignPreferencesForm() {
  const { prefs, hydrated, update } = useAppearancePrefs();
  const tx = useT();

  return (
    <div className="space-y-8">
      {!hydrated ? (
        <p className="text-sm text-zinc-500">{tx("appearance.loading")}</p>
      ) : null}

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">{tx("appearance.profileNav.title")}</h2>
          <p className="mt-0.5 text-xs text-zinc-500">{tx("appearance.profileNav.description")}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {PROFILE_NAV_OPTIONS.map((opt) => (
            <ChoiceButton
              key={opt.value}
              active={prefs.profileNav === opt.value}
              disabled={!hydrated}
              onClick={() => update({ profileNav: opt.value })}
              accent="emerald"
              title={tx(opt.labelKey)}
              hint={tx(opt.hintKey)}
              preview={<ProfileNavPreview variant={opt.value} />}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

/** Preferințe personale only — Design lives under Setări → Design. */
export function AppearancePreferencesForm() {
  return <PersonalPreferencesForm />;
}
