"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { OPS_INPUT_CLASS, OPS_LABEL_CLASS } from "@/components/fleet/ops-form-primitives";
import { uploadDocumentFile } from "@/lib/document-upload";
import {
  DAMAGE_PHOTO_KINDS,
  DAMAGE_PIPELINE_STATUSES,
  damageClaimStatusLabel,
  damagePayerLabel,
  damagePipelineStatusLabel,
  documentKindsForInsurance,
  fleetJsonHeaders,
  isDamageInsurerReady,
  mergeDamageDocuments,
  serviceCasesBrowserBase,
  vehicleMovableLabel,
  type DamageClaimStatus,
  type DamageDocumentItem,
  type DamageInsurerPipelineStatus,
  type DamageInsuranceType,
  type DamagePayerType,
  type DamagePhotoItem,
  type DamagePhotoKind,
  type DamageSectionKey,
  type DamageSectionLocks,
  type PatchDamageClaimInput,
  type ServiceCaseRecord,
  type VehicleMovableState,
} from "@/lib/service-cases-api";

type Props = {
  serviceCase: ServiceCaseRecord | null | undefined;
  canWrite: boolean;
  onUpdated?: (next: ServiceCaseRecord) => void;
  /** Compact layout for WO sheet. */
  compact?: boolean;
  /** When opened from WO, treat as „după WO” for payer hint. */
  fromWorkOrder?: boolean;
};

const INSURANCE_OPTIONS: { value: DamageInsuranceType; label: string }[] = [
  { value: "CASCO", label: "CASCO" },
  { value: "RCA", label: "RCA" },
  { value: "BOTH", label: "RCA + CASCO" },
  { value: "UNKNOWN", label: "Necunoscut" },
];

const STATUS_OPTIONS: DamageClaimStatus[] = [
  "open",
  "documents_pending",
  "insurer_review",
  "agreed",
  "rejected",
  "closed",
];

function SectionLockBadge({
  locks,
  section,
}: {
  locks: DamageSectionLocks;
  section: DamageSectionKey;
}) {
  const lock = locks[section];
  if (!lock) return null;
  return (
    <span className="rounded border border-amber-600/50 bg-amber-950/40 px-1.5 py-0.5 text-[10px] text-amber-200">
      Blocat
      {lock.lockedByLabel ? ` · ${lock.lockedByLabel}` : ""}
    </span>
  );
}

export function DamageClaimPanel({
  serviceCase,
  canWrite,
  onUpdated,
  compact,
  fromWorkOrder = false,
}: Props) {
  const isDamage = serviceCase?.workflowType === "damage";
  const [movable, setMovable] = useState<VehicleMovableState | "">("");
  const [payer, setPayer] = useState<DamagePayerType | "">("");
  const [insuranceType, setInsuranceType] = useState<DamageInsuranceType | "">("");
  const [claimNumber, setClaimNumber] = useState("");
  const [insurerName, setInsurerName] = useState("");
  const [claimStatus, setClaimStatus] = useState<DamageClaimStatus>("open");
  const [pipeline, setPipeline] = useState<DamageInsurerPipelineStatus | "">("");
  const [agreementNotes, setAgreementNotes] = useState("");
  const [docs, setDocs] = useState<DamageDocumentItem[]>([]);
  const [photos, setPhotos] = useState<DamagePhotoItem[]>([]);
  const [locks, setLocks] = useState<DamageSectionLocks>({});
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [photoKind, setPhotoKind] = useState<DamagePhotoKind>("damage_detail");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!serviceCase || serviceCase.workflowType !== "damage") return;
    setMovable(serviceCase.vehicleMovable ?? "");
    setPayer(serviceCase.damagePayerType ?? "");
    setInsuranceType(serviceCase.damageInsuranceType ?? "");
    setClaimNumber(serviceCase.damageClaimNumber ?? "");
    setInsurerName(serviceCase.damageInsurerName ?? "");
    setClaimStatus(serviceCase.damageClaimStatus ?? "open");
    setPipeline(serviceCase.damageInsurerPipelineStatus ?? "");
    setAgreementNotes(serviceCase.damageInsurerAgreementNotes ?? "");
    setDocs(
      mergeDamageDocuments(
        documentKindsForInsurance(serviceCase.damageInsuranceType),
        serviceCase.damageDocuments,
      ),
    );
    setPhotos(serviceCase.damagePhotos ?? []);
    setLocks(serviceCase.damageSectionLocks ?? {});
  }, [serviceCase]);

  useEffect(() => {
    setDocs((prev) => mergeDamageDocuments(documentKindsForInsurance(insuranceType), prev));
  }, [insuranceType]);

  const agreedAt = serviceCase?.damageInsurerAgreedAt ?? null;
  const insurerReady = isDamageInsurerReady({
    damagePayerType: payer || serviceCase?.damagePayerType,
    damageInsurerPipelineStatus: pipeline || serviceCase?.damageInsurerPipelineStatus,
    damageInsurerAgreedAt: agreedAt,
  });
  const docsReceived = useMemo(() => docs.filter((d) => d.received).length, [docs]);
  const hasWo = fromWorkOrder || (serviceCase?.workOrders?.length ?? 0) > 0;
  const isClientPayer = payer === "client";
  const isInsurerPayer = payer === "insurer" || (!payer && !isClientPayer);

  function sectionLocked(section: DamageSectionKey): boolean {
    return !!locks[section];
  }

  if (!serviceCase) {
    return (
      <p className="text-sm text-zinc-500">
        Deschide fluxul service ca să poți completa dosarul de daună.
      </p>
    );
  }

  if (!isDamage) {
    return (
      <p className="text-sm text-zinc-500">Dosarul de daună e disponibil doar pe tichete tip daună.</p>
    );
  }

  async function patch(body: PatchDamageClaimInput, successMsg: string) {
    setPending(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`${serviceCasesBrowserBase}/${serviceCase!.id}/damage-claim`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (j.message) msg = Array.isArray(j.message) ? j.message.join(", ") : j.message;
        } catch {
          /* ignore */
        }
        setError(msg);
        return null;
      }
      const next = (await res.json()) as ServiceCaseRecord;
      onUpdated?.(next);
      setLocks(next.damageSectionLocks ?? {});
      setPhotos(next.damagePhotos ?? []);
      setOk(successMsg);
      return next;
    } finally {
      setPending(false);
    }
  }

  async function saveClaimInfo() {
    await patch(
      {
        vehicleMovable: movable || null,
        damagePayerType: payer || null,
        damageInsuranceType: insuranceType || null,
        damageClaimNumber: claimNumber.trim() || null,
        damageInsurerName: insurerName.trim() || null,
        damageClaimStatus: claimStatus,
        damageInsurerAgreementNotes: agreementNotes.trim() || null,
      },
      "Informații dosar salvate.",
    );
  }

  async function saveDocuments() {
    await patch({ damageDocuments: docs }, "Documente salvate.");
  }

  async function savePipeline() {
    if (!pipeline) {
      setError("Alege un pas din pipeline.");
      return;
    }
    await patch(
      { damageInsurerPipelineStatus: pipeline },
      pipeline === "payment_accepted"
        ? "Accept plată înregistrat — In service deblocat (dacă și mobilitatea e ok)."
        : `Pipeline: ${damagePipelineStatusLabel(pipeline)}.`,
    );
  }

  async function lockSection(section: DamageSectionKey, lock: boolean) {
    await patch(
      { lockSection: { section, lock } },
      lock ? `Secțiune ${section} blocată.` : `Secțiune ${section} deblocată.`,
    );
  }

  async function onPhotoSelected(file: File | null) {
    if (!file || !canWrite) return;
    setUploading(true);
    setError(null);
    try {
      const up = await uploadDocumentFile(file, `Daună ${photoKind}`);
      const nextPhotos: DamagePhotoItem[] = [
        ...photos,
        {
          id: `photo_${Date.now()}`,
          url: up.url,
          kind: photoKind,
          caption: up.name,
          uploadedAt: new Date().toISOString(),
        },
      ];
      const saved = await patch({ damagePhotos: nextPhotos }, "Poză adăugată.");
      if (saved) setPhotos(saved.damagePhotos ?? nextPhotos);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload eșuat.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removePhoto(id: string) {
    const nextPhotos = photos.filter((p) => p.id !== id);
    const saved = await patch({ damagePhotos: nextPhotos }, "Poză ștearsă.");
    if (saved) setPhotos(saved.damagePhotos ?? nextPhotos);
  }

  const disabled = !canWrite || pending;

  return (
    <div className={`space-y-5 ${compact ? "text-sm" : ""}`}>
      <div>
        <h3 className="text-sm font-medium text-zinc-100">Dosar daună</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Deplasabilitate → plătitor → (dacă asigurător) checklist CASCO/RCA + pipeline până la Accept
          plată. Secțiunile se pot bloca după completare. Devizul de reparație rămâne pe WO.
        </p>
      </div>

      {movable === "immovable" ? (
        <div className="rounded-lg border border-sky-500/40 bg-sky-950/20 px-3 py-2 text-sm text-sky-100">
          Vehicul nedeplasabil — asistența rutieră e obligatorie (tab Asistență; se creează draft la
          deschiderea dosarului).
        </div>
      ) : null}

      {insurerReady ? (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-100">
          {isClientPayer
            ? "Plătitor client confirmat"
            : "Accept plată / acord asigurător OK"}
          {agreedAt
            ? ` · ${new Date(agreedAt).toLocaleString("ro-RO", { dateStyle: "medium", timeStyle: "short" })}`
            : ""}
          . Mai e nevoie de mașină la schimb înainte de In service.
        </div>
      ) : isClientPayer ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 px-3 py-2 text-sm text-amber-100">
          Confirmă plătitorul client ca să deblochezi execuția (împreună cu mobilitatea).
        </div>
      ) : (
        <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 px-3 py-2 text-sm text-amber-100">
          In service pe daună cere <strong>Accept plată</strong> (pipeline) + mașină la schimb
          {movable === "immovable" ? " + asistență rutieră activă" : ""}.
        </div>
      )}

      {/* Claim info */}
      <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/30 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Informații dosar
          </h4>
          <div className="flex items-center gap-2">
            <SectionLockBadge locks={locks} section="claim_info" />
            {canWrite ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => void lockSection("claim_info", !sectionLocked("claim_info"))}
                className="text-[11px] text-zinc-400 underline hover:text-zinc-200 disabled:opacity-50"
              >
                {sectionLocked("claim_info") ? "Deblochează" : "Blochează"}
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={OPS_LABEL_CLASS}>Deplasabilitate</span>
            <select
              className={OPS_INPUT_CLASS}
              disabled={disabled || sectionLocked("claim_info")}
              value={movable}
              onChange={(e) => setMovable(e.target.value as VehicleMovableState | "")}
            >
              <option value="">—</option>
              <option value="movable">Deplasabilă</option>
              <option value="immovable">Nedeplasabilă</option>
            </select>
          </label>
          <label className="block">
            <span className={OPS_LABEL_CLASS}>
              Plătitor{!hasWo ? " (recomandat după WO)" : ""}
            </span>
            <select
              className={OPS_INPUT_CLASS}
              disabled={disabled || sectionLocked("claim_info")}
              value={payer}
              onChange={(e) => setPayer(e.target.value as DamagePayerType | "")}
            >
              <option value="">— alege —</option>
              <option value="insurer">Asigurător</option>
              <option value="client">Client</option>
            </select>
          </label>
          <label className="block">
            <span className={OPS_LABEL_CLASS}>Tip asigurare</span>
            <select
              className={OPS_INPUT_CLASS}
              disabled={disabled || sectionLocked("claim_info") || isClientPayer}
              value={insuranceType}
              onChange={(e) => setInsuranceType(e.target.value as DamageInsuranceType | "")}
            >
              <option value="">—</option>
              {INSURANCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={OPS_LABEL_CLASS}>Status dosar</span>
            <select
              className={OPS_INPUT_CLASS}
              disabled={disabled || sectionLocked("claim_info")}
              value={claimStatus}
              onChange={(e) => setClaimStatus(e.target.value as DamageClaimStatus)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {damageClaimStatusLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={OPS_LABEL_CLASS}>Nr. dosar daună</span>
            <input
              className={OPS_INPUT_CLASS}
              disabled={disabled || sectionLocked("claim_info")}
              value={claimNumber}
              onChange={(e) => setClaimNumber(e.target.value)}
              placeholder="ex. DAUNA-2026-…"
            />
          </label>
          <label className="block">
            <span className={OPS_LABEL_CLASS}>Asigurător</span>
            <input
              className={OPS_INPUT_CLASS}
              disabled={disabled || sectionLocked("claim_info") || isClientPayer}
              value={insurerName}
              onChange={(e) => setInsurerName(e.target.value)}
              placeholder="Nume societate"
            />
          </label>
        </div>

        <label className="block">
          <span className={OPS_LABEL_CLASS}>Note</span>
          <textarea
            className={OPS_INPUT_CLASS}
            rows={2}
            disabled={disabled || sectionLocked("claim_info")}
            value={agreementNotes}
            onChange={(e) => setAgreementNotes(e.target.value)}
          />
        </label>

        {canWrite && !sectionLocked("claim_info") ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => void saveClaimInfo()}
              className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
            >
              Salvează informații
            </button>
            {isClientPayer && !agreedAt ? (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  void patch(
                    { damagePayerType: "client", clientPayerConfirmed: true },
                    "Plătitor client confirmat.",
                  )
                }
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                Confirmă plătitor client
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* Documents — insurer path */}
      {!isClientPayer ? (
        <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Documente{" "}
              {insuranceType === "CASCO"
                ? "CASCO"
                : insuranceType === "RCA"
                  ? "RCA"
                  : insuranceType === "BOTH"
                    ? "CASCO+RCA"
                    : ""}{" "}
              ({docsReceived}/{docs.length})
            </h4>
            <div className="flex items-center gap-2">
              <SectionLockBadge locks={locks} section="documents" />
              {canWrite ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void lockSection("documents", !sectionLocked("documents"))}
                  className="text-[11px] text-zinc-400 underline hover:text-zinc-200 disabled:opacity-50"
                >
                  {sectionLocked("documents") ? "Deblochează" : "Blochează"}
                </button>
              ) : null}
            </div>
          </div>
          {!insuranceType ? (
            <p className="text-xs text-zinc-500">Alege tipul de asigurare ca să vezi checklist-ul.</p>
          ) : (
            <ul className="space-y-2">
              {docs.map((doc) => (
                <li
                  key={doc.kind}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2"
                >
                  <label className="flex min-w-[10rem] flex-1 items-center gap-2 text-sm text-zinc-200">
                    <input
                      type="checkbox"
                      disabled={disabled || sectionLocked("documents")}
                      checked={doc.received}
                      onChange={(e) => {
                        const received = e.target.checked;
                        setDocs((prev) =>
                          prev.map((d) =>
                            d.kind === doc.kind
                              ? {
                                  ...d,
                                  received,
                                  uploadedAt: received ? new Date().toISOString() : d.uploadedAt,
                                }
                              : d,
                          ),
                        );
                      }}
                    />
                    {doc.label ?? doc.kind}
                  </label>
                  <input
                    className={`${OPS_INPUT_CLASS} max-w-xs flex-1 py-1.5 text-xs`}
                    disabled={disabled || sectionLocked("documents")}
                    placeholder="Notă (opțional)"
                    value={doc.notes ?? ""}
                    onChange={(e) => {
                      const notes = e.target.value;
                      setDocs((prev) =>
                        prev.map((d) => (d.kind === doc.kind ? { ...d, notes } : d)),
                      );
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-zinc-500">Pozele avarii sunt obligatorii — vezi galeria de mai jos.</p>
          {canWrite && !sectionLocked("documents") ? (
            <button
              type="button"
              disabled={pending || !insuranceType}
              onClick={() => void saveDocuments()}
              className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
            >
              Salvează documente
            </button>
          ) : null}
        </section>
      ) : null}

      {/* Photos */}
      <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/30 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Galerie poze ({photos.length})
          </h4>
          <div className="flex items-center gap-2">
            <SectionLockBadge locks={locks} section="photos" />
            {canWrite ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => void lockSection("photos", !sectionLocked("photos"))}
                className="text-[11px] text-zinc-400 underline hover:text-zinc-200 disabled:opacity-50"
              >
                {sectionLocked("photos") ? "Deblochează" : "Blochează"}
              </button>
            ) : null}
          </div>
        </div>
        {photos.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {photos.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 rounded border border-zinc-800 bg-zinc-950/50 px-2 py-1.5 text-xs"
              >
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-emerald-400 hover:underline"
                >
                  {DAMAGE_PHOTO_KINDS.find((k) => k.kind === p.kind)?.label ?? p.kind}
                  {p.caption ? ` · ${p.caption}` : ""}
                </a>
                {canWrite && !sectionLocked("photos") ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void removePhoto(p.id)}
                    className="shrink-0 text-rose-400 hover:underline disabled:opacity-50"
                  >
                    Șterge
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-zinc-500">Nicio poză încă.</p>
        )}
        {canWrite && !sectionLocked("photos") ? (
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className={OPS_LABEL_CLASS}>Tip poză</span>
              <select
                className={OPS_INPUT_CLASS}
                disabled={disabled || uploading}
                value={photoKind}
                onChange={(e) => setPhotoKind(e.target.value as DamagePhotoKind)}
              >
                {DAMAGE_PHOTO_KINDS.map((k) => (
                  <option key={k.kind} value={k.kind}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              disabled={disabled || uploading}
              className="text-xs text-zinc-400"
              onChange={(e) => void onPhotoSelected(e.target.files?.[0] ?? null)}
            />
          </div>
        ) : null}
        <p className="text-[11px] text-zinc-600">
          Email către asigurător (documente + poze): F1 — în curând; atașamentele rămân pe dosar.
        </p>
      </section>

      {/* Pipeline */}
      {isInsurerPayer && !isClientPayer ? (
        <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Pipeline asigurător
            </h4>
            <div className="flex items-center gap-2">
              <SectionLockBadge locks={locks} section="pipeline" />
              {canWrite ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void lockSection("pipeline", !sectionLocked("pipeline"))}
                  className="text-[11px] text-zinc-400 underline hover:text-zinc-200 disabled:opacity-50"
                >
                  {sectionLocked("pipeline") ? "Deblochează" : "Blochează"}
                </button>
              ) : null}
            </div>
          </div>
          <ol className="flex flex-wrap gap-1.5">
            {DAMAGE_PIPELINE_STATUSES.map((s) => {
              const active = (pipeline || serviceCase.damageInsurerPipelineStatus) === s.value;
              return (
                <li
                  key={s.value}
                  className={`rounded-full border px-2 py-0.5 text-[10px] ${
                    active
                      ? "border-emerald-500/60 bg-emerald-950/40 text-emerald-100"
                      : "border-zinc-700 text-zinc-500"
                  }`}
                >
                  {s.label}
                </li>
              );
            })}
          </ol>
          <label className="block max-w-sm">
            <span className={OPS_LABEL_CLASS}>Pas curent</span>
            <select
              className={OPS_INPUT_CLASS}
              disabled={disabled || sectionLocked("pipeline")}
              value={pipeline}
              onChange={(e) => setPipeline(e.target.value as DamageInsurerPipelineStatus | "")}
            >
              <option value="">—</option>
              {DAMAGE_PIPELINE_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          {canWrite && !sectionLocked("pipeline") ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending || !pipeline}
                onClick={() => void savePipeline()}
                className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
              >
                Actualizează pipeline
              </button>
              {pipeline !== "payment_accepted" ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setPipeline("payment_accepted");
                    void patch(
                      { damageInsurerPipelineStatus: "payment_accepted" },
                      "Accept plată înregistrat.",
                    );
                  }}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  Accept plată
                </button>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <p className="text-[11px] text-zinc-600">
        Stare: {vehicleMovableLabel(movable || serviceCase.vehicleMovable)} · plătitor{" "}
        {damagePayerLabel(payer || serviceCase.damagePayerType)}
        {!isClientPayer
          ? ` · pipeline ${damagePipelineStatusLabel(pipeline || serviceCase.damageInsurerPipelineStatus)}`
          : ""}
      </p>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      {ok ? <p className="text-sm text-emerald-400">{ok}</p> : null}
    </div>
  );
}

/** Map WO detail damage fields into a ServiceCaseRecord shape for the shared panel. */
export function serviceCaseFromWorkOrderDamage(wo: {
  serviceCaseId: string;
  clientId: string;
  vehicleId: string;
  serviceCaseStage: string;
  serviceCaseStatus: string;
  serviceCaseTitle?: string;
  title: string;
  supplierId: string | null;
  supplierLegalName: string | null;
  sourceTicketId: string | null;
  awaitingPostApproval: boolean;
  postApprovalPath: "immediate" | "reschedule" | null;
  createdAt: string;
  updatedAt: string;
  vehicleMovable?: VehicleMovableState | null;
  damagePayerType?: DamagePayerType | null;
  damageInsurerPipelineStatus?: DamageInsurerPipelineStatus | null;
  damageInsuranceType?: DamageInsuranceType | null;
  damageClaimNumber?: string | null;
  damageInsurerName?: string | null;
  damageClaimStatus?: string | null;
  damageInsurerAgreedAt?: string | null;
  damageDocuments?: DamageDocumentItem[];
  damagePhotos?: DamagePhotoItem[];
  damageSectionLocks?: DamageSectionLocks;
}): ServiceCaseRecord {
  return {
    id: wo.serviceCaseId,
    clientId: wo.clientId,
    vehicleId: wo.vehicleId,
    workflowType: "damage",
    sourceType: "ticket",
    sourceTicketId: wo.sourceTicketId,
    currentStage: wo.serviceCaseStage as ServiceCaseRecord["currentStage"],
    status: wo.serviceCaseStatus,
    supplierId: wo.supplierId,
    supplierLegalName: wo.supplierLegalName,
    title: wo.serviceCaseTitle ?? wo.title,
    notes: null,
    closedAt: null,
    awaitingPostApproval: wo.awaitingPostApproval,
    postApprovalPath: wo.postApprovalPath,
    vehicleMovable: wo.vehicleMovable ?? null,
    damageInsuranceType: wo.damageInsuranceType ?? null,
    damageClaimNumber: wo.damageClaimNumber ?? null,
    damageInsurerName: wo.damageInsurerName ?? null,
    damageClaimStatus: (wo.damageClaimStatus as DamageClaimStatus | null) ?? null,
    damageInsurerAgreedAt: wo.damageInsurerAgreedAt ?? null,
    damagePayerType: wo.damagePayerType ?? null,
    damageInsurerPipelineStatus: wo.damageInsurerPipelineStatus ?? null,
    damageDocuments: wo.damageDocuments ?? [],
    damagePhotos: wo.damagePhotos ?? [],
    damageSectionLocks: wo.damageSectionLocks ?? {},
    createdAt: wo.createdAt,
    updatedAt: wo.updatedAt,
    workOrders: [],
    appointments: [],
  };
}
