"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { OpsReminderFields } from "@/components/fleet/OpsReminderFields";
import { uploadDocumentFile } from "@/lib/document-upload";
import {
  OPS_INPUT_CLASS,
  OpsFormCollapsible,
  OpsFormField,
  OpsFormPrimaryBand,
  OpsFormSection,
  OpsFormStickyActions,
} from "@/components/fleet/ops-form-primitives";
import { useOpsFormVehicleBinding } from "@/lib/ops-form-context";
import { DOCUMENT_TYPE_OPTIONS } from "@/lib/document-types";
import {
  hasConfiguredOpsReminder,
  inferReminderConstraintMode,
  type ReminderConstraintMode,
} from "@/lib/ops-reminder-fields";

type DocumentRecord = {
  id: string;
  vehicleId: string;
  documentTypeCode: string;
  title: string;
  expiresOn: string | null;
  fileUrl: string | null;
  fileName?: string | null;
  reminderOffsetsDays?: number[] | null;
  dueOdometerKm?: number | null;
  reminderOffsetsKm?: number[] | null;
  reminderMenuSyncEnabled?: boolean;
};

type VehicleOption = {
  id: string;
  registrationNumber: string;
  clientId: string;
  odometerKm?: number;
};

type Props =
  | { mode: "create"; vehicles: VehicleOption[]; defaultVehicleId?: string }
  | { mode: "edit"; documentId: string; initial: DocumentRecord; vehicles: VehicleOption[] };

function toDateInputOrEmpty(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

async function readErrorMessage(res: Response): Promise<string> {
  let msg = `HTTP ${res.status}`;
  try {
    const j = (await res.json()) as { message?: string | string[] };
    if (typeof j.message === "string") msg = j.message;
    else if (Array.isArray(j.message)) msg = j.message.join(", ");
  } catch {}
  return msg;
}

export function DocumentForm(props: Props) {
  const router = useRouter();
  const isEdit = props.mode === "edit";

  const initial = useMemo(() => {
    if (props.mode === "create") {
      return {
        vehicleId: props.defaultVehicleId ?? props.vehicles[0]?.id ?? "",
        documentTypeCode: "rca",
        title: "",
        expiresOn: "",
        fileUrl: "",
        fileName: "",
        reminderOffsetsDays: [] as number[],
        dueOdometerKm: null as number | null,
        reminderOffsetsKm: [] as number[],
      };
    }
    const r = props.initial;
    return {
      vehicleId: r.vehicleId,
      documentTypeCode: r.documentTypeCode,
      title: r.title,
      expiresOn: toDateInputOrEmpty(r.expiresOn),
      fileUrl: r.fileUrl ?? "",
      fileName: r.fileName ?? "",
      reminderOffsetsDays: r.reminderOffsetsDays?.length ? [...r.reminderOffsetsDays] : [],
      dueOdometerKm: r.dueOdometerKm ?? null,
      reminderOffsetsKm: r.reminderOffsetsKm?.length ? [...r.reminderOffsetsKm] : [],
    };
  }, [props]);

  const [vehicleId, setVehicleId] = useState(initial.vehicleId);
  const selectedVehicleLocal = props.vehicles.find((v) => v.id === vehicleId) ?? null;
  const { embedded, vehicleId: boundVehicleId, selectedVehicle, formClassName } = useOpsFormVehicleBinding({
    vehicleId,
    selectedVehicle: selectedVehicleLocal,
  });
  const [documentTypeCode, setDocumentTypeCode] = useState(initial.documentTypeCode);
  const [title, setTitle] = useState(initial.title);
  const [expiresOn, setExpiresOn] = useState(initial.expiresOn);
  const [fileUrl, setFileUrl] = useState(initial.fileUrl);
  const [fileName, setFileName] = useState(initial.fileName);
  const [reminderOffsetsDays, setReminderOffsetsDays] = useState<number[]>(initial.reminderOffsetsDays);
  const [dueOdometerKm, setDueOdometerKm] = useState<number | null>(initial.dueOdometerKm);
  const [reminderOffsetsKm, setReminderOffsetsKm] = useState<number[]>(initial.reminderOffsetsKm);
  const [constraintMode, setConstraintMode] = useState<ReminderConstraintMode>(() =>
    inferReminderConstraintMode({ dueDate: initial.expiresOn, dueOdometerKm: initial.dueOdometerKm }),
  );
  const [syncReminderAction, setSyncReminderAction] = useState(
    () =>
      props.mode === "edit"
        ? (props.initial.reminderMenuSyncEnabled ?? true)
        : initial.documentTypeCode !== "civ",
  );
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPickFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadDocumentFile(file, title || documentTypeCode);
      setFileUrl(uploaded.url);
      setFileName(uploaded.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload eșuat.");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const expiryIso =
      constraintMode !== "km" && expiresOn.trim() ? new Date(expiresOn).toISOString() : null;
    if (constraintMode !== "km" && expiresOn.trim() && !expiryIso) {
      setError("Data expirării este invalidă.");
      setPending(false);
      return;
    }

    const kmDue = constraintMode !== "time" ? dueOdometerKm : null;
    const dayOffsets = constraintMode !== "km" && expiryIso ? reminderOffsetsDays : null;
    const kmOffsets = constraintMode !== "time" && kmDue != null ? reminderOffsetsKm : null;
    const configured = hasConfiguredOpsReminder({
      mode: constraintMode,
      dueDate: expiresOn,
      reminderOffsetsDays: dayOffsets ?? [],
      dueOdometerKm: kmDue,
      reminderOffsetsKm: kmOffsets ?? [],
    });

    const payload = {
      vehicleId: boundVehicleId,
      documentTypeCode,
      title: title.trim(),
      expiresOn: expiryIso,
      fileUrl: fileUrl.trim() ? fileUrl.trim() : null,
      fileName: fileName.trim() ? fileName.trim() : null,
      reminderOffsetsDays: dayOffsets,
      dueOdometerKm: kmDue,
      reminderOffsetsKm: kmOffsets,
      syncReminderAction: configured ? syncReminderAction : false,
    };

    try {
      const url = isEdit ? `/api/documents/${props.documentId}` : "/api/documents";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setError(await readErrorMessage(res));
        return;
      }
      const data = (await res.json()) as { id: string; reminderSyncFailed?: boolean };
      if (data.reminderSyncFailed) {
        router.push(`/fleet/documents/${data.id}?reminderSync=failed`);
      } else {
        router.push(`/fleet/documents/${data.id}`);
      }
      router.refresh();
    } catch {
      setError("Rețea sau server indisponibil.");
    } finally {
      setPending(false);
    }
  }

  const useP1Layout = embedded;

  const reminderBlock = (
    <OpsReminderFields
      constraintMode={constraintMode}
      onConstraintModeChange={setConstraintMode}
      dueDate={expiresOn}
      onDueDateChange={setExpiresOn}
      dueDateLabel="Data expirare"
      dueDateHint="Necesară pentru remindere pe dată. Lăsați gol dacă documentul nu expiră la o dată fixă."
      reminderOffsetsDays={reminderOffsetsDays}
      onReminderOffsetsDaysChange={setReminderOffsetsDays}
      dueOdometerKm={dueOdometerKm}
      onDueOdometerKmChange={setDueOdometerKm}
      reminderOffsetsKm={reminderOffsetsKm}
      onReminderOffsetsKmChange={setReminderOffsetsKm}
      vehicleOdometerKm={selectedVehicle?.odometerKm ?? 0}
      syncReminderAction={syncReminderAction}
      onSyncReminderActionChange={setSyncReminderAction}
      disabled={pending}
    />
  );

  if (useP1Layout) {
    return (
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
        {error ? <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">{error}</p> : null}
        <OpsFormPrimaryBand module="documents" title={isEdit ? "Actualizare — câmpuri obligatorii" : "Înregistrare — câmpuri obligatorii"}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <OpsFormField label="Tip document" required>
              <select
                value={documentTypeCode}
                onChange={(e) => {
                  const next = e.target.value;
                  setDocumentTypeCode(next);
                  if (next === "civ") setSyncReminderAction(false);
                }}
                required
                className={OPS_INPUT_CLASS}
              >
                {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </OpsFormField>
            <OpsFormField label="Titlu" required>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="ex. RCA 2026" className={OPS_INPUT_CLASS} />
            </OpsFormField>
            <OpsFormField label="Data expirare">
              <input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className={OPS_INPUT_CLASS} />
            </OpsFormField>
          </div>
        </OpsFormPrimaryBand>
        <OpsFormSection number={4} title="Fișier document">
          <div className="grid grid-cols-1 gap-3">
            <OpsFormField label="Upload" hint="PDF sau imagine, max 10MB.">
              <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={uploading || pending} onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)} className={`${OPS_INPUT_CLASS} file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:text-zinc-200`} />
            </OpsFormField>
            <OpsFormField label="URL fișier (alternativ)">
              <input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://…" className={OPS_INPUT_CLASS} />
            </OpsFormField>
          </div>
        </OpsFormSection>
        <OpsFormCollapsible title="5. Termene & remindere (pliable)">{reminderBlock}</OpsFormCollapsible>
        <OpsFormStickyActions
          submitLabel={isEdit ? "Salvează modificările" : "Creează documentul"}
          pendingLabel="Se salvează…"
          cancelHref={isEdit ? `/fleet/documents/${props.documentId}` : "/fleet/documents"}
          pending={pending}
          disabled={props.vehicles.length === 0}
        />
      </form>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className={formClassName}>
      {error ? (
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          {error}
        </p>
      ) : null}
      {!embedded ? (
        <>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">Vehicul</label>
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
            >
              {props.vehicles.length === 0 ? <option value="">Nu există vehicule</option> : null}
              {props.vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.registrationNumber}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">Client</label>
            <input
              value={selectedVehicleLocal?.clientId ?? ""}
              readOnly
              className="w-full cursor-not-allowed rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300 outline-none"
            />
          </div>
        </>
      ) : null}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Tip document</label>
        <select
          value={documentTypeCode}
          onChange={(e) => {
            const next = e.target.value;
            setDocumentTypeCode(next);
            if (props.mode === "create" && next === "civ") setSyncReminderAction(false);
          }}
          required
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
        >
          {DOCUMENT_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Titlu / descriere</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="ex. RCA 2026 — Allianz"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
        />
      </div>

      {reminderBlock}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Fișier document</label>
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          disabled={uploading || pending}
          onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:text-zinc-200"
        />
        {uploading ? <p className="text-xs text-zinc-500">Se încarcă fișierul…</p> : null}
        <p className="text-xs text-zinc-500">PDF sau imagine (max 10MB). Opțional — poți folosi și URL mai jos.</p>
        {fileUrl ? (
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <a href={fileUrl} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">
              {fileName || "Fișier încărcat"}
            </a>
            <button
              type="button"
              onClick={() => {
                setFileUrl("");
                setFileName("");
              }}
              className="text-zinc-400 hover:text-zinc-200"
            >
              Elimină
            </button>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">URL fișier (alternativ)</label>
        <input
          value={fileUrl}
          onChange={(e) => setFileUrl(e.target.value)}
          placeholder="https://…"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending || uploading || props.vehicles.length === 0}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          {pending ? "Se salvează…" : isEdit ? "Salvează" : "Adaugă document"}
        </button>
        <Link
          href="/fleet/documents"
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
        >
          Anulează
        </Link>
      </div>
    </form>
  );
}
