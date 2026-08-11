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
  OpsFormVehicleField,
} from "@/components/fleet/ops-form-primitives";
import { useOpsFormVehicleBinding } from "@/lib/ops-form-context";
import {
  DOCUMENT_TYPE_OPTIONS,
  documentTypeLabel,
  isCivDocumentTypeCode,
} from "@/lib/document-types";
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

type FileSlot = { url: string; name: string };

export function DocumentForm(props: Props) {
  const router = useRouter();
  const isEdit = props.mode === "edit";

  const initial = useMemo(() => {
    if (props.mode === "create") {
      return {
        vehicleId: props.defaultVehicleId ?? "",
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
  const { embedded, vehicleLocked, vehicleId: boundVehicleId, selectedVehicle, formClassName } = useOpsFormVehicleBinding({
    vehicleId,
    selectedVehicle: selectedVehicleLocal,
  });
  const [documentTypeCode, setDocumentTypeCode] = useState(initial.documentTypeCode);
  const [title, setTitle] = useState(initial.title);
  const [expiresOn, setExpiresOn] = useState(initial.expiresOn);
  const [fileUrl, setFileUrl] = useState(initial.fileUrl);
  const [fileName, setFileName] = useState(initial.fileName);
  const [civFront, setCivFront] = useState<FileSlot | null>(null);
  const [civVerso, setCivVerso] = useState<FileSlot | null>(null);
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
        : !isCivDocumentTypeCode(initial.documentTypeCode),
  );
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCivCreate = !isEdit && documentTypeCode === "civ";
  const isCivSideEdit =
    isEdit && (documentTypeCode === "civ_fata" || documentTypeCode === "civ_verso" || documentTypeCode === "civ");

  const typeOptions = useMemo(() => {
    if (isEdit && (documentTypeCode === "civ_fata" || documentTypeCode === "civ_verso")) {
      return [
        ...DOCUMENT_TYPE_OPTIONS.filter((o) => o.value !== "civ"),
        { value: documentTypeCode, label: documentTypeLabel(documentTypeCode) },
      ];
    }
    return [...DOCUMENT_TYPE_OPTIONS];
  }, [isEdit, documentTypeCode]);

  async function onPickFile(file: File | null, slot: "single" | "front" | "verso") {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const label =
        slot === "front" ? "CIV față" : slot === "verso" ? "CIV verso" : title || documentTypeCode;
      const uploaded = await uploadDocumentFile(file, label);
      if (slot === "front") setCivFront({ url: uploaded.url, name: uploaded.name });
      else if (slot === "verso") setCivVerso({ url: uploaded.url, name: uploaded.name });
      else {
        setFileUrl(uploaded.url);
        setFileName(uploaded.name);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload eșuat.");
    } finally {
      setUploading(false);
    }
  }

  async function postDocument(payload: Record<string, unknown>): Promise<{ id: string; reminderSyncFailed?: boolean }> {
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res));
    return (await res.json()) as { id: string; reminderSyncFailed?: boolean };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    if (!isEdit && !boundVehicleId) {
      setError("Selectează vehiculul.");
      setPending(false);
      return;
    }

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

    try {
      if (isCivCreate) {
        if (!civFront?.url) {
          setError("Încarcă CIV față (obligatoriu). Serie CIV e pe față.");
          setPending(false);
          return;
        }
        if (!civVerso?.url) {
          setError("Încarcă și CIV verso — maparea OCR folosește ambele pagini.");
          setPending(false);
          return;
        }
        const baseTitle = title.trim() || "CIV";
        const reminderPayload = {
          reminderOffsetsDays: dayOffsets,
          dueOdometerKm: kmDue,
          reminderOffsetsKm: kmOffsets,
          syncReminderAction: false,
        };
        await postDocument({
          vehicleId: boundVehicleId,
          documentTypeCode: "civ_fata",
          title: `${baseTitle} — față`,
          expiresOn: expiryIso,
          fileUrl: civFront.url,
          fileName: civFront.name,
          ...reminderPayload,
        });
        const verso = await postDocument({
          vehicleId: boundVehicleId,
          documentTypeCode: "civ_verso",
          title: `${baseTitle} — verso`,
          expiresOn: expiryIso,
          fileUrl: civVerso.url,
          fileName: civVerso.name,
          ...reminderPayload,
        });
        if (verso.reminderSyncFailed) {
          router.push("/fleet/documents?reminderSync=failed");
        } else {
          router.push("/fleet/documents");
        }
        router.refresh();
        return;
      }

      const payload = {
        ...(isEdit ? {} : { vehicleId: boundVehicleId }),
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
        router.push("/fleet/documents?reminderSync=failed");
      } else {
        router.push("/fleet/documents");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rețea sau server indisponibil.");
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
      disabled={pending || isCivCreate}
    />
  );

  function renderCivDualUpload() {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <OpsFormField
          label="CIV față"
          required
          hint="Pagina cu barcode / QR. Serie CIV = literă + 6 cifre, sub barcode."
        >
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp,.pdf"
            disabled={uploading || pending}
            onChange={(e) => void onPickFile(e.target.files?.[0] ?? null, "front")}
            className={`${OPS_INPUT_CLASS} file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:text-zinc-200`}
          />
          {civFront ? (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              <span className="rounded-md border border-emerald-800/50 bg-emerald-950/30 px-2 py-1 text-emerald-200">
                Față atașată
              </span>
              <a href={civFront.url} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">
                {civFront.name}
              </a>
              <button type="button" onClick={() => setCivFront(null)} className="text-zinc-400 hover:text-zinc-200">
                Elimină
              </button>
            </div>
          ) : null}
        </OpsFormField>
        <OpsFormField label="CIV verso" required hint="Pagina cu caracteristici tehnice (P.1, mase, etc.).">
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp,.pdf"
            disabled={uploading || pending}
            onChange={(e) => void onPickFile(e.target.files?.[0] ?? null, "verso")}
            className={`${OPS_INPUT_CLASS} file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:text-zinc-200`}
          />
          {civVerso ? (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              <span className="rounded-md border border-emerald-800/50 bg-emerald-950/30 px-2 py-1 text-emerald-200">
                Verso atașat
              </span>
              <a href={civVerso.url} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">
                {civVerso.name}
              </a>
              <button type="button" onClick={() => setCivVerso(null)} className="text-zinc-400 hover:text-zinc-200">
                Elimină
              </button>
            </div>
          ) : null}
        </OpsFormField>
      </div>
    );
  }

  function renderSingleUpload(label = "Upload") {
    return (
      <OpsFormField label={label} hint="PDF sau imagine, max 10MB. Alege fișierul, așteaptă confirmarea, apoi Salvează.">
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,.pdf"
          disabled={uploading || pending}
          onChange={(e) => void onPickFile(e.target.files?.[0] ?? null, "single")}
          className={`${OPS_INPUT_CLASS} file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:text-zinc-200`}
        />
        {uploading ? <p className="mt-1 text-xs text-zinc-400">Se încarcă fișierul…</p> : null}
        {fileUrl ? (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            <span className="rounded-md border border-emerald-800/50 bg-emerald-950/30 px-2 py-1 text-emerald-200">
              Fișier atașat
            </span>
            <a href={fileUrl} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">
              {fileName || "Deschide fișier"}
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
        ) : !uploading ? (
          <p className="mt-1 text-xs text-amber-200/80">
            Niciun fișier atașat încă — Browse nu salvează singur; trebuie Salvează după upload.
          </p>
        ) : null}
      </OpsFormField>
    );
  }

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
                  if (isCivDocumentTypeCode(next) || next === "civ") setSyncReminderAction(false);
                }}
                required
                className={OPS_INPUT_CLASS}
              >
                {typeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </OpsFormField>
            <OpsFormField label="Titlu" required>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder={isCivCreate ? "ex. CIV Logan B157EFI" : "ex. RCA 2026"}
                className={OPS_INPUT_CLASS}
              />
            </OpsFormField>
            <OpsFormField label="Data expirare">
              <input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className={OPS_INPUT_CLASS} />
            </OpsFormField>
          </div>
        </OpsFormPrimaryBand>
        <OpsFormSection number={4} title={isCivCreate ? "Scan CIV (față + verso)" : "Fișier document"}>
          {isCivCreate ? (
            renderCivDualUpload()
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {renderSingleUpload(
                isCivSideEdit
                  ? documentTypeCode === "civ_verso"
                    ? "CIV verso"
                    : documentTypeCode === "civ_fata"
                      ? "CIV față"
                      : "Upload"
                  : "Upload",
              )}
              <OpsFormField label="URL fișier (alternativ)">
                <input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://… sau /uploads/…" className={OPS_INPUT_CLASS} />
              </OpsFormField>
            </div>
          )}
          {uploading && isCivCreate ? <p className="mt-2 text-xs text-zinc-400">Se încarcă fișierul…</p> : null}
        </OpsFormSection>
        {!isCivCreate ? <OpsFormCollapsible title="5. Termene & remindere (pliable)">{reminderBlock}</OpsFormCollapsible> : null}
        <OpsFormStickyActions
          submitLabel={isEdit ? "Salvează modificările" : isCivCreate ? "Creează CIV față + verso" : "Creează documentul"}
          pendingLabel="Se salvează…"
          cancelHref="/fleet/documents"
          pending={pending || uploading}
          disabled={props.vehicles.length === 0 || (!isEdit && !boundVehicleId) || uploading}
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
        <OpsFormVehicleField
          vehicles={props.vehicles}
          vehicleId={vehicleId}
          onVehicleIdChange={setVehicleId}
          locked={isEdit || vehicleLocked}
        />
      ) : null}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Tip document</label>
        <select
          value={documentTypeCode}
          onChange={(e) => {
            const next = e.target.value;
            setDocumentTypeCode(next);
            if (props.mode === "create" && (next === "civ" || isCivDocumentTypeCode(next))) {
              setSyncReminderAction(false);
            }
          }}
          required
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
        >
          {typeOptions.map((opt) => (
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
          placeholder={isCivCreate ? "ex. CIV Logan B157EFI" : "ex. RCA 2026 — Allianz"}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/40 focus:ring-2"
        />
      </div>

      {!isCivCreate ? reminderBlock : null}

      {isCivCreate ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-zinc-300">Scan CIV — față + verso</p>
          {renderCivDualUpload()}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">Fișier document</label>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              disabled={uploading || pending}
              onChange={(e) => void onPickFile(e.target.files?.[0] ?? null, "single")}
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
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending || uploading || props.vehicles.length === 0 || (!isEdit && !boundVehicleId)}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          {pending
            ? "Se salvează…"
            : isEdit
              ? "Salvează"
              : isCivCreate
                ? "Adaugă CIV față + verso"
                : "Adaugă document"}
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
