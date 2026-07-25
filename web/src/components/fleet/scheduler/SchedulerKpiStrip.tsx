"use client";

import type { AppointmentStats } from "@/lib/appointments-api";
import type { SchedulerInboxFilter } from "@/lib/scheduler-deep-link";
import { appointmentStatusBadgeClass } from "./appointment-status-colors";

type Props = {
  stats: AppointmentStats | null;
  activeInbox?: SchedulerInboxFilter;
  onInboxChange?: (inbox: SchedulerInboxFilter) => void;
  partnerMode?: boolean;
};

export function SchedulerKpiStrip({ stats, activeInbox = "all", onInboxChange, partnerMode }: Props) {
  const items: { key: SchedulerInboxFilter; label: string; value: number; warn?: boolean }[] = [
    { key: "all", label: "Toate (săpt.)", value: stats?.thisWeek ?? 0 },
    {
      key: "pending_supplier",
      label: partnerMode ? "De validat (eu)" : "De validat furnizor",
      value: stats?.pendingSupplier ?? 0,
      warn: (stats?.pendingSupplier ?? 0) > 0,
    },
    {
      key: "needs_repropose",
      label: partnerMode ? "Șofer nu poate" : "Reprogramare (șofer)",
      value: stats?.needsRepropose ?? 0,
      warn: (stats?.needsRepropose ?? 0) > 0,
    },
    {
      key: "scheduled",
      label: partnerMode ? "De confirmat flotă" : "De confirmat",
      value: stats?.awaitingConfirm ?? stats?.scheduled ?? 0,
      warn: !partnerMode && (stats?.awaitingConfirm ?? stats?.scheduled ?? 0) > 0,
    },
    { key: "confirmed", label: "Confirmate", value: stats?.confirmed ?? 0 },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => {
        const active = activeInbox === item.key;
        const clickable = !!onInboxChange;
        const inner = (
          <>
            <p className="text-xs uppercase tracking-wide text-zinc-500">{item.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-100">{item.value}</p>
          </>
        );
        if (!clickable) {
          return (
            <div
              key={item.key}
              className={`rounded-xl border px-4 py-3 ${
                item.warn ? "border-amber-800/50 bg-amber-950/20" : "border-zinc-800 bg-zinc-900/50"
              }`}
            >
              {inner}
            </div>
          );
        }
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onInboxChange(item.key)}
            className={`rounded-xl border px-4 py-3 text-left transition-colors hover:bg-zinc-900/70 ${
              active
                ? "border-emerald-600/50 bg-emerald-950/20 ring-1 ring-emerald-500/30"
                : item.warn
                  ? "border-amber-800/50 bg-amber-950/20"
                  : "border-zinc-800 bg-zinc-900/50"
            }`}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}

export function SchedulerStatusLegend() {
  const items = [
    { cls: appointmentStatusBadgeClass("pending_supplier"), label: "De validat" },
    { cls: appointmentStatusBadgeClass("needs_repropose"), label: "Șofer nu poate" },
    { cls: appointmentStatusBadgeClass("scheduled"), label: "De confirmat" },
    { cls: appointmentStatusBadgeClass("confirmed"), label: "Confirmat" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 text-[10px] text-zinc-500 lg:px-4">
      <span className="uppercase tracking-wide">Status:</span>
      {items.map((item) => (
        <span key={item.label} className={`rounded border px-1.5 py-0.5 ${item.cls}`}>
          {item.label}
        </span>
      ))}
      <span className="text-zinc-600">· punct = categorie furnizor</span>
    </div>
  );
}
