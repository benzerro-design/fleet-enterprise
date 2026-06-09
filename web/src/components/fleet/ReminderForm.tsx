"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ReminderKmPicker } from "@/components/fleet/ReminderKmPicker";
import { ReminderSchedulePicker } from "@/components/fleet/ReminderSchedulePicker";
import { DEFAULT_REMINDER_OFFSETS } from "@/lib/document-reminders";
import {
  CUSTOM_REMINDER_PRESETS,
  REMINDER_SOURCE_TYPES,
  type ReminderActionRow,
  type ReminderSourceType,
} from "@/lib/reminder-actions";
import { documentTypeLabel } from "@/lib/document-types";
import { useOpsFormVehicleBinding } from "@/lib/ops-form-context";

type VehicleOption = {
  id: string;
  registrationNumber: string;
  clientId: string;
};

type VehicleContext = {
  vehicleOdometerKm: number;
  registrationNumber: string;
  documents: Array<{ id: string; title: string; documentTypeCode: string; expiresOn: string | null }>;
  maintenance: Array<{ id: string; title: string; performedAt: string | null; odometerKm: number | null }>;
};

type Props =
  | { mode: "create"; vehicles: VehicleOption[]; defaultVehicleId?: string }
  | { mode: "edit"; reminderId: string; initial: ReminderActionRow; vehicles: VehicleOption[] };

async function readErrorMessage(res: Response): Promise<string> {
  let msg = `HTTP ${res.status}`;
  try {
    const j = (await res.json()) as { message?: string | string[] };
    if (typeof j.message === "string") msg = j.message;
    else if (Array.isArray(j.message)) msg = j.message.join(", ");
  } catch {}
  return msg;
}

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

export function ReminderForm(props: Props) {
  const router = useRouter();
  const isEdit = props.mode === "edit";

  const initial = useMemo(() => {
    if (props.mode === "create") {
      return {
        vehicleId: props.defaultVehicleId ?? props.vehicles[0]?.id ?? "",
        sourceType: "custom" as ReminderSourceType,
        title: "",
        notes: "",
        vehicleDocumentId: "",
        maintenanceEntryId: "",
        dueOn: "",
        reminderOffsetsDays: [...DEFAULT_REMINDER_OFFSETS] as number[],
        dueOdometerKm: null as number | null,
        reminderOffsetsKm: [] as number[],
        intervalDays: "",
        intervalKm: "",
      };
    }
    const r = props.initial;
    return {
      vehicleId: r.vehicleId,
      sourceType: r.sourceType,
      title: r.title,
      notes: r.notes ?? "",
      vehicleDocumentId: r.vehicleDocumentId ?? "",
      maintenanceEntryId: r.maintenanceEntryId ?? "",
      dueOn: toDateInput(r.dueOn),
      reminderOffsetsDays: r.reminderOffsetsDays?.length ? [...r.reminderOffsetsDays] : [],
      dueOdometerKm: r.dueOdometerKm,
      reminderOffsetsKm: r.reminderOffsetsKm?.length ? [...r.reminderOffsetsKm] : [],
      intervalDays: r.intervalDays != null ? String(r.intervalDays) : "",
      intervalKm: r.intervalKm != null ? String(r.intervalKm) : "",
    };
  }, [props]);

  const [vehicleId, setVehicleId] = useState(initial.vehicleId);
  const selectedVehicleLocal = props.vehicles.find((v) => v.id === vehicleId);
  const { embedded, vehicleId: boundVehicleId } = useOpsFormVehicleBinding({
    vehicleId,
    selectedVehicle: selectedVehicleLocal,
  });
  const formClassName = embedded ? "space-y-6" : "mx-auto max-w-2xl space-y-6";
  const [sourceType, setSourceType] = useState<ReminderSourceType>(initial.sourceType);
  const [title, setTitle] = useState(initial.title);
  const [notes, setNotes] = useState(initial.notes);
  const [vehicleDocumentId, setVehicleDocumentId] = useState(initial.vehicleDocumentId);
  const [maintenanceEntryId, setMaintenanceEntryId] = useState(initial.maintenanceEntryId);
  const [dueOn, setDueOn] = useState(initial.dueOn);
  const [reminderOffsetsDays, setReminderOffsetsDays] = useState(initial.reminderOffsetsDays);
  const [dueOdometerKm, setDueOdometerKm] = useState(initial.dueOdometerKm);
  const [reminderOffsetsKm, setReminderOffsetsKm] = useState(initial.reminderOffsetsKm);
  const [intervalDays, setIntervalDays] = useState(initial.intervalDays);
  const [intervalKm, setIntervalKm] = useState(initial.intervalKm);
  const [ctx, setCtx] = useState<VehicleContext | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadContext = useCallback(async (vid: string) => {
    if (!vid) {
      setCtx(null);
      return;
    }
    try {
      const res = await fetch(`/api/reminders/context/${vid}`);
      if (!res.ok) return;
      setCtx((await res.json()) as VehicleContext);
    } catch {
      setCtx(null);
    }
  }, []);

  useEffect(() => {
    void loadContext(boundVehicleId);
  }, [boundVehicleId, loadContext]);

  const odometer = ctx?.vehicleOdometerKm ?? (props.mode === "edit" ? props.initial.vehicleOdometerKm : 0);
  const isDocumentLinked = isEdit && props.mode === "edit" && props.initial.sourceType === "document";

  function applyDocumentLink(docId: string) {
    setVehicleDocumentId(docId);
    const doc = ctx?.documents.find((d) => d.id === docId);
    if (!doc) return;
    setTitle(doc.title);
    if (doc.expiresOn) {
      setDueOn(toDateInput(doc.expiresOn));
      if (reminderOffsetsDays.length === 0) setReminderOffsetsDays([...DEFAULT_REMINDER_OFFSETS]);
    }
  }

  function applyMaintenanceLink(mId: string) {
    setMaintenanceEntryId(mId);
    const m = ctx?.maintenance.find((x) => x.id === mId);
    if (m) setTitle(m.title);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    if (!boundVehicleId) {
      setError("Selectează un vehicul.");
      setPending(false);
      return;
    }
    if (!title.trim()) {
      setError("Titlul acțiunii este obligatoriu.");
      setPending(false);
      return;
    }
    if (sourceType === "document" && !vehicleDocumentId) {
      setError("Selectează documentul legat.");
      setPending(false);
      return;
    }
    if (sourceType === "maintenance" && !maintenanceEntryId) {
      setError("Selectează intervenția de mentenanță.");
      setPending(false);
      return;
    }

    const hasTime = Boolean(dueOn.trim());
    const hasKm = dueOdometerKm != null && dueOdometerKm > 0;
    const hasInterval = Boolean(intervalDays.trim()) || Boolean(intervalKm.trim());
    if (sourceType === "custom" && !hasTime && !hasKm && !hasInterval) {
      setError("Pentru acțiune personalizată, setează data scadență, km țintă sau un interval.");
      setPending(false);
      return;
    }

    const payload = {
      vehicleId: boundVehicleId,
      sourceType,
      title: title.trim(),
      notes: notes.trim() ? notes.trim() : null,
      vehicleDocumentId:
        sourceType === "document" ? vehicleDocumentId || null : null,
      maintenanceEntryId:
        sourceType === "maintenance" ? maintenanceEntryId || null : null,
      dueOn: dueOn.trim() ? new Date(dueOn).toISOString() : null,
      reminderOffsetsDays: dueOn.trim() && reminderOffsetsDays.length > 0 ? reminderOffsetsDays : null,
      dueOdometerKm,
      reminderOffsetsKm: dueOdometerKm != null && reminderOffsetsKm.length > 0 ? reminderOffsetsKm : null,
      intervalDays: intervalDays.trim() ? parseInt(intervalDays, 10) : null,
      intervalKm: intervalKm.trim() ? parseInt(intervalKm, 10) : null,
    };

    try {
      const url = isEdit ? `/api/reminders/${props.reminderId}` : "/api/reminders";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setError(await readErrorMessage(res));
        return;
      }
      await res.json();
      const back = boundVehicleId
        ? `/fleet/vehicles/${boundVehicleId}#reminders`
        : `/fleet/reminders?status=all`;
      router.push(back);
      router.refresh();
    } catch {
      setError("Nu am putut salva.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className={formClassName}>
      {error ? (
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          {error}
        </p>
      ) : null}
      {!embedded ? (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">Vehicul</label>
          <select
            value={vehicleId}
            disabled={isDocumentLinked || pending}
            onChange={(e) => {
              setVehicleId(e.target.value);
              setVehicleDocumentId("");
              setMaintenanceEntryId("");
            }}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          >
            {props.vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.registrationNumber} · {v.clientId}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Tip acțiune</label>
        <select
          value={sourceType}
          disabled={isDocumentLinked || pending}
          onChange={(e) => {
            const st = e.target.value as ReminderSourceType;
            setSourceType(st);
            setVehicleDocumentId("");
            setMaintenanceEntryId("");
          }}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        >
          {REMINDER_SOURCE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {sourceType === "document" ? (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">Document legat</label>
          <select
            value={vehicleDocumentId}
            disabled={isDocumentLinked || pending || !ctx?.documents.length}
            onChange={(e) => applyDocumentLink(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          >
            <option value="">— Alege document —</option>
            {ctx?.documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title} ({documentTypeLabel(d.documentTypeCode)})
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {sourceType === "maintenance" ? (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">Mentenanță legată</label>
          <select
            value={maintenanceEntryId}
            disabled={pending || !ctx?.maintenance.length}
            onChange={(e) => applyMaintenanceLink(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          >
            <option value="">— Alege intervenție —</option>
            {ctx?.maintenance.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
                {m.performedAt ? ` · ${new Date(m.performedAt).toLocaleDateString("ro-RO")}` : ""}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {sourceType === "custom" ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
          <p className="text-[10px] uppercase tracking-wide text-zinc-600">Șabloane rapide</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {CUSTOM_REMINDER_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                disabled={pending}
                onClick={() => {
                  setTitle(p.title);
                  if ("intervalKm" in p && p.intervalKm) setIntervalKm(String(p.intervalKm));
                  if ("intervalDays" in p && p.intervalDays) setIntervalDays(String(p.intervalDays));
                }}
                className="rounded-full border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-400 hover:border-violet-700 hover:text-violet-200"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Titlu acțiune</label>
        <input
          value={title}
          disabled={isDocumentLinked || pending}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Note (opțional)</label>
        <textarea
          value={notes}
          disabled={pending}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">Interval zile (opțional)</label>
          <input
            type="number"
            min={0}
            value={intervalDays}
            disabled={pending}
            onChange={(e) => setIntervalDays(e.target.value)}
            placeholder="ex. 365"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">Interval km (opțional)</label>
          <input
            type="number"
            min={0}
            value={intervalKm}
            disabled={pending}
            onChange={(e) => setIntervalKm(e.target.value)}
            placeholder="ex. 15000"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Scadență (dată)</label>
        <input
          type="date"
          value={dueOn}
          disabled={isDocumentLinked || pending}
          onChange={(e) => {
            const v = e.target.value;
            setDueOn(v);
            if (v && reminderOffsetsDays.length === 0) setReminderOffsetsDays([...DEFAULT_REMINDER_OFFSETS]);
          }}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />
      </div>

      {dueOn ? (
        <ReminderSchedulePicker
          expiresOn={dueOn}
          offsets={reminderOffsetsDays}
          onChange={setReminderOffsetsDays}
          disabled={isDocumentLinked || pending}
        />
      ) : null}

      <ReminderKmPicker
        dueOdometerKm={dueOdometerKm}
        offsets={reminderOffsetsKm}
        currentOdometerKm={odometer}
        onChange={setReminderOffsetsKm}
        onDueOdometerChange={setDueOdometerKm}
        disabled={pending}
      />

      {isDocumentLinked ? (
        <p className="text-xs text-violet-300/90">
          Reminder legat de document — unele câmpuri se actualizează din Documente.
        </p>
      ) : null}

      {error ? <p className="text-sm text-amber-400">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending || !boundVehicleId || !title.trim()}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {pending ? "Se salvează…" : isEdit ? "Salvează" : "Creează acțiune"}
        </button>
        <Link
          href={isEdit ? `/fleet/reminders/${props.reminderId}` : "/fleet/reminders"}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
        >
          Anulează
        </Link>
      </div>
    </form>
  );
}
