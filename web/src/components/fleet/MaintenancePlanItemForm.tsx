"use client";

import { OpsReminderFields } from "@/components/fleet/OpsReminderFields";
import { previewNextDue } from "@/lib/maintenance-plan-preview";
import {
  MAINTENANCE_PLAN_CATEGORIES,
  TRIGGER_MODE_LABELS,
  type MaintenancePlanTemplate,
} from "@/lib/maintenance-plan-templates";
import type {
  MaintenancePlanItemRecord,
  MaintenancePlanTriggerMode,
} from "@/lib/maintenance-plan-types";
import { formatRonFromCents, parseRonToCents } from "@/lib/money";
import {
  defaultDayOffsetsForMode,
  defaultKmOffsets,
  hasConfiguredOpsReminder,
  type ReminderConstraintMode,
} from "@/lib/ops-reminder-fields";
import { fleetBrowserBase, fleetJsonHeaders } from "@/lib/fleet-api";
import { useMemo, useState, type FormEvent } from "react";

type Props = {
  vehicleId: string;
  vehicleOdometerKm: number;
  write: boolean;
  editing: MaintenancePlanItemRecord | null;
  template: MaintenancePlanTemplate | null;
  onClose: () => void;
  onSaved: (item: MaintenancePlanItemRecord) => void;
};

function isoDateOnly(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function triggerToConstraint(mode: MaintenancePlanTriggerMode, hasTime: boolean, hasKm: boolean): ReminderConstraintMode {
  if (mode === "time") return "time";
  if (mode === "km") return "km";
  if (hasTime && hasKm) return "both";
  if (hasKm) return "km";
  return "time";
}

export function MaintenancePlanItemForm({
  vehicleId,
  vehicleOdometerKm,
  write,
  editing,
  template,
  onClose,
  onSaved,
}: Props) {
  const initial = useMemo(() => {
    const src = editing ?? template;
    const triggerMode = (editing?.triggerMode ?? template?.triggerMode ?? "whichever_first") as MaintenancePlanTriggerMode;
    return {
      title: editing?.title ?? template?.title ?? "",
      category: editing?.category ?? template?.category ?? "",
      notes: editing?.notes ?? template?.notes ?? "",
      triggerMode,
      intervalDays: editing?.intervalDays ?? template?.intervalDays ?? "",
      intervalKm: editing?.intervalKm ?? template?.intervalKm ?? "",
      lastServiceOn: isoDateOnly(editing?.lastServiceOn ?? null),
      lastServiceKm: editing?.lastServiceKm != null ? String(editing.lastServiceKm) : "",
      dueManualOverride: editing?.dueManualOverride ?? false,
      nextDueOn: isoDateOnly(editing?.nextDueOn ?? null),
      dueOdometerKm: editing?.dueOdometerKm != null ? String(editing.dueOdometerKm) : "",
      preferredProvider: editing?.preferredProvider ?? "",
      estimatedCost: editing?.estimatedCostCents != null ? formatRonFromCents(editing.estimatedCostCents) : "",
      reminderOffsetsDays: editing?.reminderOffsetsDays?.length
        ? [...editing.reminderOffsetsDays]
        : defaultDayOffsetsForMode(false),
      reminderOffsetsKm: editing?.reminderOffsetsKm?.length ? [...editing.reminderOffsetsKm] : defaultKmOffsets(),
      syncReminderAction: editing?.reminderMenuSyncEnabled ?? true,
      isActive: editing?.isActive ?? true,
    };
  }, [editing, template]);

  const [title, setTitle] = useState(initial.title);
  const [category, setCategory] = useState(initial.category);
  const [notes, setNotes] = useState(initial.notes);
  const [triggerMode, setTriggerMode] = useState<MaintenancePlanTriggerMode>(initial.triggerMode);
  const [intervalDays, setIntervalDays] = useState(String(initial.intervalDays ?? ""));
  const [intervalKm, setIntervalKm] = useState(String(initial.intervalKm ?? ""));
  const [lastServiceOn, setLastServiceOn] = useState(initial.lastServiceOn);
  const [lastServiceKm, setLastServiceKm] = useState(initial.lastServiceKm);
  const [dueManualOverride, setDueManualOverride] = useState(initial.dueManualOverride);
  const [nextDueOn, setNextDueOn] = useState(initial.nextDueOn);
  const [dueOdometerKm, setDueOdometerKm] = useState(initial.dueOdometerKm);
  const [preferredProvider, setPreferredProvider] = useState(initial.preferredProvider);
  const [estimatedCost, setEstimatedCost] = useState(initial.estimatedCost);
  const [reminderOffsetsDays, setReminderOffsetsDays] = useState(initial.reminderOffsetsDays);
  const [reminderOffsetsKm, setReminderOffsetsKm] = useState(initial.reminderOffsetsKm);
  const [syncReminderAction, setSyncReminderAction] = useState(initial.syncReminderAction);
  const [isActive, setIsActive] = useState(initial.isActive);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasTimeInterval = triggerMode !== "km";
  const hasKmInterval = triggerMode !== "time";

  const preview = useMemo(() => {
    if (dueManualOverride) {
      return {
        nextDueOn: nextDueOn.trim() || null,
        dueOdometerKm: dueOdometerKm.trim() ? Number(dueOdometerKm) : null,
      };
    }
    const days = intervalDays.trim() ? Number(intervalDays) : null;
    const km = intervalKm.trim() ? Number(intervalKm) : null;
    return previewNextDue({
      triggerMode,
      intervalDays: Number.isFinite(days) ? days : null,
      intervalKm: Number.isFinite(km) ? km : null,
      lastServiceOn,
      lastServiceKm: lastServiceKm.trim() ? Number(lastServiceKm) : null,
      vehicleOdometerKm,
    });
  }, [
    dueManualOverride,
    nextDueOn,
    dueOdometerKm,
    triggerMode,
    intervalDays,
    intervalKm,
    lastServiceOn,
    lastServiceKm,
    vehicleOdometerKm,
  ]);

  const constraintMode = triggerToConstraint(
    triggerMode,
    hasTimeInterval && Boolean(intervalDays.trim()),
    hasKmInterval && Boolean(intervalKm.trim()),
  );

  const reminderDueDate = preview.nextDueOn ?? "";
  const reminderDueKm = preview.dueOdometerKm;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!write) return;
    setPending(true);
    setError(null);

    const t = title.trim();
    if (!t) {
      setError("Titlul operațiunii este obligatoriu.");
      setPending(false);
      return;
    }

    const days = intervalDays.trim() ? Number(intervalDays) : null;
    const km = intervalKm.trim() ? Number(intervalKm) : null;
    if ((days == null || days <= 0) && (km == null || km <= 0)) {
      setError("Setați cel puțin un interval (zile sau km).");
      setPending(false);
      return;
    }

    const configured = hasConfiguredOpsReminder({
      mode: constraintMode,
      dueDate: reminderDueDate,
      reminderOffsetsDays,
      dueOdometerKm: reminderDueKm,
      reminderOffsetsKm,
    });

    const costCents = estimatedCost.trim() ? parseRonToCents(estimatedCost) : null;
    if (estimatedCost.trim() && costCents === null) {
      setError("Cost estimat invalid (RON, max 2 zecimale).");
      setPending(false);
      return;
    }

    const body: Record<string, unknown> = {
      title: t,
      category: category.trim() || null,
      notes: notes.trim() || null,
      triggerMode,
      intervalDays: days,
      intervalKm: km,
      lastServiceOn: lastServiceOn.trim() ? `${lastServiceOn}T12:00:00.000Z` : null,
      lastServiceKm: lastServiceKm.trim() ? Number(lastServiceKm) : null,
      dueManualOverride,
      nextDueOn: dueManualOverride && nextDueOn.trim() ? `${nextDueOn}T12:00:00.000Z` : null,
      dueOdometerKm: dueManualOverride && dueOdometerKm.trim() ? Number(dueOdometerKm) : null,
      preferredProvider: preferredProvider.trim() || null,
      estimatedCostCents: costCents,
      reminderOffsetsDays: configured ? reminderOffsetsDays : null,
      reminderOffsetsKm: configured ? reminderOffsetsKm : null,
      syncReminderAction: configured ? syncReminderAction : false,
      isActive,
    };

    try {
      const url = editing
        ? `${fleetBrowserBase}/vehicles/${vehicleId}/maintenance-plan/${editing.id}`
        : `${fleetBrowserBase}/vehicles/${vehicleId}/maintenance-plan`;
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (typeof j.message === "string") msg = j.message;
          else if (Array.isArray(j.message)) msg = j.message.join(", ");
        } catch {}
        setError(msg);
        return;
      }
      const saved = (await res.json()) as MaintenancePlanItemRecord;
      onSaved(saved);
      onClose();
    } catch {
      setError("Rețea sau server indisponibil.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/95 px-5 py-4 backdrop-blur">
          <div>
            <h3 className="text-lg font-semibold text-zinc-100">
              {editing ? "Editare operațiune PM" : template ? "Adaugă din șablon" : "Operațiune nouă"}
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500">Plan mentenanță preventivă — per vehicul</p>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
            ✕
          </button>
        </div>

        <form onSubmit={(e) => void onSubmit(e)} className="space-y-6 p-5">
          {error ? (
            <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">{error}</p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-zinc-300">Operațiune / task service</label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
                placeholder="ex. Schimb ulei motor + filtru"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300">Categorie</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
              >
                <option value="">—</option>
                {MAINTENANCE_PLAN_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300">Mod declanșare</label>
              <select
                value={triggerMode}
                onChange={(e) => setTriggerMode(e.target.value as MaintenancePlanTriggerMode)}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
              >
                {(Object.keys(TRIGGER_MODE_LABELS) as MaintenancePlanTriggerMode[]).map((m) => (
                  <option key={m} value={m}>
                    {TRIGGER_MODE_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-violet-900/40 bg-violet-950/15 p-4">
            <p className="text-sm font-medium text-violet-200/90">Interval recurent</p>
            <p className="mt-1 text-xs text-zinc-500">
              Model „first-to-occur” (Fleetio): service la interval calendaristic, kilometraj sau primul care vine.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {hasTimeInterval ? (
                <div>
                  <label className="block text-xs text-zinc-400">Interval timp (zile)</label>
                  <input
                    type="number"
                    min={1}
                    value={intervalDays}
                    onChange={(e) => setIntervalDays(e.target.value)}
                    placeholder="ex. 365 (= 12 luni)"
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-100"
                  />
                </div>
              ) : null}
              {hasKmInterval ? (
                <div>
                  <label className="block text-xs text-zinc-400">Interval km</label>
                  <input
                    type="number"
                    min={1}
                    value={intervalKm}
                    onChange={(e) => setIntervalKm(e.target.value)}
                    placeholder="ex. 15000"
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-100"
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-300">Ultimul service (dată)</label>
              <input
                type="date"
                value={lastServiceOn}
                onChange={(e) => setLastServiceOn(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300">Ultimul service (km)</label>
              <input
                type="number"
                min={0}
                value={lastServiceKm}
                onChange={(e) => setLastServiceKm(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-100"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={dueManualOverride}
              onChange={(e) => setDueManualOverride(e.target.checked)}
              className="rounded border-zinc-600"
            />
            Setez manual următorul termen (ignoră calculul automat)
          </label>

          {dueManualOverride ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm text-zinc-400">Următorul termen (dată)</label>
                <input
                  type="date"
                  value={nextDueOn}
                  onChange={(e) => setNextDueOn(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400">Următorul termen (km)</label>
                <input
                  type="number"
                  min={0}
                  value={dueOdometerKm}
                  onChange={(e) => setDueOdometerKm(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm"
                />
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-300">Furnizor preferat</label>
              <input
                value={preferredProvider}
                onChange={(e) => setPreferredProvider(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300">Cost estimat (RON fără TVA)</label>
              <input
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                placeholder="opțional"
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300">Note / instrucțiuni</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
          </div>

          {!dueManualOverride && (preview.nextDueOn || preview.dueOdometerKm != null) ? (
            <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/15 px-4 py-3 text-sm">
              <p className="text-emerald-300/90">Previzualizare următor termen</p>
              <p className="mt-1 font-mono text-zinc-200">
                {preview.nextDueOn
                  ? new Date(`${preview.nextDueOn}T12:00:00.000Z`).toLocaleDateString("ro-RO")
                  : "—"}
                {preview.dueOdometerKm != null ? ` · ${preview.dueOdometerKm.toLocaleString("ro-RO")} km` : ""}
              </p>
            </div>
          ) : null}

          <OpsReminderFields
            constraintMode={constraintMode}
            onConstraintModeChange={() => {}}
            dueDate={reminderDueDate}
            onDueDateChange={() => {}}
            dueDateLabel="Alerte înainte de termen"
            dueDateHint="Termenul scadenței se calculează automat din interval și ultimul service."
            reminderOffsetsDays={reminderOffsetsDays}
            onReminderOffsetsDaysChange={setReminderOffsetsDays}
            dueOdometerKm={reminderDueKm}
            onDueOdometerKmChange={() => {}}
            reminderOffsetsKm={reminderOffsetsKm}
            onReminderOffsetsKmChange={setReminderOffsetsKm}
            vehicleOdometerKm={vehicleOdometerKm}
            syncReminderAction={syncReminderAction}
            onSyncReminderActionChange={setSyncReminderAction}
            disabled={pending}
            fixedMode={constraintMode}
          />

          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-zinc-600"
            />
            Operațiune activă în plan
          </label>

          <div className="flex flex-wrap gap-3 border-t border-zinc-800 pt-4">
            <button
              type="submit"
              disabled={pending || !write}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {pending ? "Salvez…" : editing ? "Salvează" : "Adaugă în plan"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
            >
              Anulează
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
