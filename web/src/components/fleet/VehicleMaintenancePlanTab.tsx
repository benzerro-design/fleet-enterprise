"use client";

import { MaintenancePlanItemForm } from "@/components/fleet/MaintenancePlanItemForm";
import { fleetBrowserBase, fleetJsonHeaders } from "@/lib/fleet-api";
import { formatRonFromCents } from "@/lib/money";
import { planAccentBar, planStatusLabel, planStatusStyles } from "@/lib/maintenance-plan-status";
import {
  MAINTENANCE_PLAN_TEMPLATES,
  type MaintenancePlanTemplate,
} from "@/lib/maintenance-plan-templates";
import type { MaintenancePlanItemRecord, MaintenancePlanPayload } from "@/lib/maintenance-plan-types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type Props = {
  vehicleId: string;
  write: boolean;
  initial: MaintenancePlanPayload;
  highlightItemId?: string | null;
};

export function VehicleMaintenancePlanTab({ vehicleId, write, initial, highlightItemId }: Props) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [filter, setFilter] = useState<"all" | "action" | "active">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenancePlanItemRecord | null>(null);
  const [template, setTemplate] = useState<MaintenancePlanTemplate | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return data.items.filter((item) => {
      if (filter === "active") return item.isActive;
      if (filter === "action") {
        const s = item.summary.status;
        return (
          item.isActive &&
          (s === "due_soon" ||
            s === "km_due_soon" ||
            s === "due_today" ||
            s === "expired" ||
            s === "km_overdue")
        );
      }
      return true;
    });
  }, [data.items, filter]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setTemplate(null);
    setFormOpen(true);
  }, []);

  const openTemplate = useCallback((t: MaintenancePlanTemplate) => {
    setEditing(null);
    setTemplate(t);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((item: MaintenancePlanItemRecord) => {
    setEditing(item);
    setTemplate(null);
    setFormOpen(true);
  }, []);

  useEffect(() => {
    if (!highlightItemId || !write) return;
    const item = data.items.find((i) => i.id === highlightItemId);
    if (item) openEdit(item);
  }, [highlightItemId, write, data.items, openEdit]);

  async function markPerformed(item: MaintenancePlanItemRecord) {
    if (!write) return;
    setPendingId(item.id);
    try {
      const res = await fetch(
        `${fleetBrowserBase}/vehicles/${vehicleId}/maintenance-plan/${item.id}/mark-performed`,
        { method: "POST", headers: fleetJsonHeaders(), body: JSON.stringify({}) },
      );
      if (!res.ok) return;
      const updated = (await res.json()) as MaintenancePlanItemRecord;
      setData((prev) => ({
        ...prev,
        items: prev.items.map((i) => (i.id === updated.id ? updated : i)),
      }));
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function deleteItem(item: MaintenancePlanItemRecord) {
    if (!write || !confirm(`Elimini „${item.title}" din plan?`)) return;
    setPendingId(item.id);
    try {
      const res = await fetch(`${fleetBrowserBase}/vehicles/${vehicleId}/maintenance-plan/${item.id}`, {
        method: "DELETE",
      });
      if (!res.ok) return;
      setData((prev) => ({
        ...prev,
        items: prev.items.filter((i) => i.id !== item.id),
        stats: {
          ...prev.stats,
          total: prev.stats.total - 1,
          active: item.isActive ? prev.stats.active - 1 : prev.stats.active,
        },
      }));
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  function onSaved(item: MaintenancePlanItemRecord) {
    setData((prev) => {
      const exists = prev.items.some((i) => i.id === item.id);
      const items = exists ? prev.items.map((i) => (i.id === item.id ? item : i)) : [...prev.items, item];
      return { ...prev, items };
    });
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-violet-900/40 bg-violet-950/20 p-4">
        <p className="text-sm font-medium text-violet-200/90">Plan mentenanță preventivă (PM)</p>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">
          Definește operațiuni recurente per vehicul — interval calendaristic, kilometraj sau primul care
          intervine (model Fleetio / OEM). Fiecare operațiune poate genera automat remindere în meniul
          Remindere. La efectuare, marchează service-ul pentru recalcularea următorului termen.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Operațiuni" value={String(data.stats.total)} hint={`${data.stats.active} active`} />
        <StatCard label="Scad curând" value={String(data.stats.dueSoon)} accent="amber" />
        <StatCard label="Depășite" value={String(data.stats.overdue)} accent="rose" />
        <StatCard label="Remindere sync" value={String(data.stats.syncedReminders)} accent="emerald" />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "Toate"],
              ["action", "Necesită acțiune"],
              ["active", "Doar active"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`rounded-full border px-3 py-1 text-xs ${
                filter === id
                  ? "border-violet-700 bg-violet-950/40 text-violet-200"
                  : "border-zinc-700 text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {write ? (
          <div className="flex flex-wrap gap-2">
            <select
              defaultValue=""
              onChange={(e) => {
                const t = MAINTENANCE_PLAN_TEMPLATES.find((x) => x.id === e.target.value);
                if (t) openTemplate(t);
                e.target.value = "";
              }}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-300"
            >
              <option value="">+ Din șablon PM…</option>
              {MAINTENANCE_PLAN_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={openCreate}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
            >
              + Operațiune custom
            </button>
          </div>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/30 px-6 py-12 text-center">
          <p className="text-sm text-zinc-400">
            {data.items.length === 0
              ? "Niciun task PM definit. Adaugă din șabloane OEM sau creează operațiuni custom."
              : "Nicio operațiune nu corespunde filtrului."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((item) => (
            <li
              key={item.id}
              className={`relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 ${
                highlightItemId === item.id ? "ring-2 ring-violet-500/50" : ""
              } ${!item.isActive ? "opacity-60" : ""}`}
            >
              <span
                className={`absolute bottom-0 left-0 top-0 w-1 ${planAccentBar(item.summary.status)}`}
              />
              <div className="flex flex-col gap-4 p-4 pl-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-zinc-100">{item.title}</h3>
                    {item.category ? (
                      <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400">
                        {item.category}
                      </span>
                    ) : null}
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] ${planStatusStyles(item.summary.status)}`}
                    >
                      {planStatusLabel(item.summary.status)}
                    </span>
                    {item.reminderMenuSyncEnabled ? (
                      <span className="text-[10px] text-fuchsia-400/80">● Reminder</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">Interval: {item.intervalLabel}</p>
                  <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <dt className="text-zinc-600">Următor termen</dt>
                      <dd className="font-mono text-zinc-300">
                        {item.nextDueOn
                          ? new Date(item.nextDueOn).toLocaleDateString("ro-RO")
                          : "—"}
                        {item.dueOdometerKm != null
                          ? ` · ${item.dueOdometerKm.toLocaleString("ro-RO")} km`
                          : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-zinc-600">Ultimul service</dt>
                      <dd className="font-mono text-zinc-300">
                        {item.lastServiceOn
                          ? new Date(item.lastServiceOn).toLocaleDateString("ro-RO")
                          : "—"}
                        {item.lastServiceKm != null
                          ? ` · ${item.lastServiceKm.toLocaleString("ro-RO")} km`
                          : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-zinc-600">Km curent vehicul</dt>
                      <dd className="font-mono text-sky-300/90">
                        {data.vehicleOdometerKm.toLocaleString("ro-RO")} km
                      </dd>
                    </div>
                    {item.preferredProvider ? (
                      <div>
                        <dt className="text-zinc-600">Furnizor</dt>
                        <dd className="text-zinc-300">{item.preferredProvider}</dd>
                      </div>
                    ) : null}
                    {item.estimatedCostCents != null ? (
                      <div>
                        <dt className="text-zinc-600">Cost estimat</dt>
                        <dd className="font-mono text-zinc-300">
                          {formatRonFromCents(item.estimatedCostCents)} RON
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  {item.notes ? (
                    <p className="mt-2 line-clamp-2 text-xs text-zinc-500">{item.notes}</p>
                  ) : null}
                </div>
                {write ? (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={pendingId === item.id}
                      onClick={() => void markPerformed(item)}
                      className="rounded-md border border-emerald-800/60 bg-emerald-600/20 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-600/30 disabled:opacity-50"
                    >
                      Efectuat
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
                    >
                      Editează
                    </button>
                    <button
                      type="button"
                      disabled={pendingId === item.id}
                      onClick={() => void deleteItem(item)}
                      className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 hover:text-rose-300 disabled:opacity-50"
                    >
                      Șterge
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {formOpen ? (
        <MaintenancePlanItemForm
          vehicleId={vehicleId}
          vehicleOdometerKm={data.vehicleOdometerKm}
          write={write}
          editing={editing}
          template={template}
          onClose={() => setFormOpen(false)}
          onSaved={onSaved}
        />
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "amber" | "rose" | "emerald";
}) {
  const border =
    accent === "amber"
      ? "border-amber-900/40 bg-amber-950/20"
      : accent === "rose"
        ? "border-rose-900/40 bg-rose-950/20"
        : accent === "emerald"
          ? "border-emerald-900/40 bg-emerald-950/20"
          : "border-zinc-800 bg-zinc-950/30";
  return (
    <div className={`rounded-lg border p-4 ${border}`}>
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-100">{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}
