"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { OpsFormModuleKey } from "@/lib/ops-section-theme";
import type { OpsVehicleOption } from "@/lib/ops-form-context";

export const OPS_INPUT_CLASS =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2";
export const OPS_INPUT_MONO_CLASS = `${OPS_INPUT_CLASS} font-mono`;
export const OPS_LABEL_CLASS = "mb-1 block text-[11px] font-medium text-zinc-400";

/** Tab-uri tip Comandă / Dosar (activ = emerald pe fundal zinc). */
export function fleetSheetTabClass(active: boolean): string {
  return `rounded-t-lg border px-4 py-2 text-sm transition-colors ${
    active
      ? "border-zinc-700 border-b-zinc-900 bg-zinc-900 text-emerald-300"
      : "border-transparent text-zinc-500 hover:text-zinc-200"
  }`;
}

const PRIMARY_BAND: Record<OpsFormModuleKey, { border: string; bg: string; title: string }> = {
  maintenance: {
    border: "border-emerald-500/40",
    bg: "bg-emerald-950/20",
    title: "text-emerald-300/90",
  },
  costs: {
    border: "border-sky-500/40",
    bg: "bg-sky-950/20",
    title: "text-sky-300/90",
  },
  documents: {
    border: "border-violet-500/40",
    bg: "bg-violet-950/20",
    title: "text-violet-300/90",
  },
  reminders: {
    border: "border-fuchsia-500/40",
    bg: "bg-fuchsia-950/20",
    title: "text-fuchsia-300/90",
  },
  trips: {
    border: "border-amber-500/40",
    bg: "bg-amber-950/20",
    title: "text-amber-300/90",
  },
};

export function OpsFormField({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className={OPS_LABEL_CLASS}>
        {label}
        {required ? " *" : ""}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

export function OpsFormPrimaryBand({
  module,
  title,
  children,
}: {
  module: OpsFormModuleKey;
  title: string;
  children: ReactNode;
}) {
  const band = PRIMARY_BAND[module];
  return (
    <div className={`rounded-xl border px-4 py-3.5 ${band.border} ${band.bg}`}>
      <p className={`mb-3 text-xs font-semibold ${band.title}`}>{title}</p>
      {children}
    </div>
  );
}

export function OpsFormSection({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-l-[3px] border-zinc-700 pl-3.5">
      <h3 className="mb-3 text-sm font-semibold text-zinc-200">
        {number}. {title}
      </h3>
      {children}
    </section>
  );
}

export function OpsFormCollapsible({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-zinc-800/80">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-zinc-300 hover:bg-zinc-900/40"
        aria-expanded={open}
      >
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
            clipRule="evenodd"
          />
        </svg>
        {title}
      </button>
      {open ? <div className="space-y-4 border-t border-zinc-800/80 px-3 py-4">{children}</div> : null}
    </div>
  );
}

export function OpsFormStickyActions({
  submitLabel,
  pendingLabel,
  cancelHref,
  pending,
  disabled,
  submitClassName = "rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-50",
}: {
  submitLabel: string;
  pendingLabel: string;
  cancelHref: string;
  pending: boolean;
  disabled?: boolean;
  submitClassName?: string;
}) {
  return (
    <div className="sticky bottom-0 mt-2 flex flex-wrap gap-3 border-t border-zinc-800 bg-zinc-950/95 py-4 backdrop-blur-sm">
      <button
        type="submit"
        disabled={pending || disabled}
        className={submitClassName}
      >
        {pending ? pendingLabel : submitLabel}
      </button>
      <Link
        href={cancelHref}
        className="inline-flex items-center rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
      >
        Anulează
      </Link>
    </div>
  );
}

export function OpsFormVehicleField({
  vehicles,
  vehicleId,
  onVehicleIdChange,
  locked,
}: {
  vehicles: OpsVehicleOption[];
  vehicleId: string;
  onVehicleIdChange: (id: string) => void;
  locked?: boolean;
}) {
  const selected = vehicles.find((v) => v.id === vehicleId);

  return (
    <>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Vehicul</label>
        {locked ? (
          <>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2">
              <span className="font-mono text-sm font-semibold text-zinc-100">
                {selected?.registrationNumber ?? "—"}
              </span>
              <span className="shrink-0 rounded-full border border-sky-800/60 bg-sky-950/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-300/90">
                Fixat
              </span>
            </div>
            <p className="text-xs text-zinc-500">Vehiculul înregistrării nu poate fi schimbat la editare.</p>
          </>
        ) : (
          <select
            required
            value={vehicleId}
            onChange={(e) => onVehicleIdChange(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
          >
            {vehicles.length === 0 ? (
              <option value="">Nu există vehicule</option>
            ) : (
              <option value="">— Selectează vehiculul —</option>
            )}
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.registrationNumber}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Client</label>
        <input
          value={selected?.clientId ?? ""}
          readOnly
          className="w-full cursor-not-allowed rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300 outline-none"
        />
      </div>
    </>
  );
}
