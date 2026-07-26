"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { OPS_INPUT_CLASS, OPS_LABEL_CLASS } from "@/components/fleet/ops-form-primitives";
import { uploadDocumentFile } from "@/lib/document-upload";
import {
  DAMAGE_KIND_TO_FLEET_DOC,
  DAMAGE_PHOTO_KINDS,
  DAMAGE_PHOTO_KINDS_INITIAL,
  DAMAGE_PIPELINE_STATUSES,
  damageClaimStatusLabel,
  damagePayerLabel,
  damagePipelineStatusLabel,
  documentKindsForInsurance,
  fleetJsonHeaders,
  isDamageInsurerReady,
  isInspectionPdfDoc,
  isReinspectionRequest,
  mergeDamageDocuments,
  quoteStatusLabel,
  serviceCasesBrowserBase,
  vehicleMovableLabel,
  type DamageClaimStatus,
  type DamageConstatareHistoryItem,
  type DamageDocumentItem,
  type DamageDocumentKind,
  type DamageInsurerMailLogItem,
  type DamageInsurerPipelineStatus,
  type DamageInspectionMode,
  type DamageInsuranceType,
  type DamagePayerType,
  type DamagePhotoItem,
  type DamagePhotoKind,
  type DamageQuoteOrigin,
  type DamageSectionKey,
  type DamageSectionLocks,
  type PatchDamageClaimInput,
  type ServiceCaseRecord,
  type VehicleMovableState,
} from "@/lib/service-cases-api";
import Link from "next/link";
import { documentsBrowserBase, fleetBrowserBase } from "@/lib/fleet-api";
import { insurersBrowserBase, type InsurerRecord } from "@/lib/insurers-api";

type Props = {
  serviceCase: ServiceCaseRecord | null | undefined;
  canWrite: boolean;
  onUpdated?: (next: ServiceCaseRecord) => void;
  /** Compact layout for WO sheet. */
  compact?: boolean;
  /** When opened from WO, treat as „după WO” for payer hint. */
  fromWorkOrder?: boolean;
  /** Nr. înmatriculare — pentru import din Documente flotă. */
  registrationNumber?: string | null;
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
  registrationNumber = null,
}: Props) {
  const isDamage = serviceCase?.workflowType === "damage";
  const [movable, setMovable] = useState<VehicleMovableState | "">("");
  const [payer, setPayer] = useState<DamagePayerType | "">("");
  const [insuranceType, setInsuranceType] = useState<DamageInsuranceType | "">("");
  const [claimNumber, setClaimNumber] = useState("");
  const [insurerId, setInsurerId] = useState("");
  const [insurerName, setInsurerName] = useState("");
  const [insurerCatalog, setInsurerCatalog] = useState<InsurerRecord[]>([]);
  const [claimStatus, setClaimStatus] = useState<DamageClaimStatus>("open");
  const [pipeline, setPipeline] = useState<DamageInsurerPipelineStatus | "">("");
  const [agreementNotes, setAgreementNotes] = useState("");
  const [franchiseRon, setFranchiseRon] = useState("");
  const [insurerEmail, setInsurerEmail] = useState("");
  const [quoteOrigin, setQuoteOrigin] = useState<DamageQuoteOrigin | "">("");
  const [mailLog, setMailLog] = useState<DamageInsurerMailLogItem[]>([]);
  const [insurerPdfUrl, setInsurerPdfUrl] = useState<string | null>(null);
  const [sendNote, setSendNote] = useState("");
  const [avizareNote, setAvizareNote] = useState("");
  const [avizareDocIds, setAvizareDocIds] = useState<Set<string>>(new Set());
  const [avizarePhotoIds, setAvizarePhotoIds] = useState<Set<string>>(new Set());
  const [inspectionMode, setInspectionMode] = useState<DamageInspectionMode | "">("");
  const [inspectionNotePdfUrl, setInspectionNotePdfUrl] = useState<string | null>(null);
  const [inspectionNoteFileName, setInspectionNoteFileName] = useState<string | null>(null);
  const [inspectionNoteIssuedOn, setInspectionNoteIssuedOn] = useState("");
  const [inspectionNoteNotes, setInspectionNoteNotes] = useState("");
  const [inspectionNotesHistory, setInspectionNotesHistory] = useState<
    DamageConstatareHistoryItem[]
  >([]);
  const [paymentAcceptancePdfUrl, setPaymentAcceptancePdfUrl] = useState<string | null>(null);
  const [paymentAcceptanceFileName, setPaymentAcceptanceFileName] = useState<string | null>(null);
  const [paymentAcceptanceNotes, setPaymentAcceptanceNotes] = useState("");
  const [reinspectionNote, setReinspectionNote] = useState("");
  const [reinspectionPhotoIds, setReinspectionPhotoIds] = useState<Set<string>>(new Set());
  const [rejectionDrafts, setRejectionDrafts] = useState<Record<string, string>>({});
  const [repairedPhotoKind] = useState<DamagePhotoKind>("repaired");
  const repairedFileRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<DamageDocumentItem[]>([]);
  const [photos, setPhotos] = useState<DamagePhotoItem[]>([]);
  const [locks, setLocks] = useState<DamageSectionLocks>({});
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importingKind, setImportingKind] = useState<string | null>(null);
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
    setInsurerId(serviceCase.damageInsurerId ?? "");
    setInsurerName(serviceCase.damageInsurerName ?? "");
    setClaimStatus(serviceCase.damageClaimStatus ?? "open");
    setPipeline(serviceCase.damageInsurerPipelineStatus ?? "");
    setAgreementNotes(serviceCase.damageInsurerAgreementNotes ?? "");
    setFranchiseRon(
      serviceCase.damageCascoFranchiseCents != null
        ? (serviceCase.damageCascoFranchiseCents / 100).toFixed(2)
        : "",
    );
    setInsurerEmail(serviceCase.damageInsurerEmail ?? "");
    setQuoteOrigin(serviceCase.damageQuoteOrigin ?? "");
    setMailLog(serviceCase.damageInsurerMailLog ?? []);
    setInsurerPdfUrl(serviceCase.damageInsurerQuotePdfUrl ?? null);
    setInspectionMode(serviceCase.damageInspectionMode ?? "");
    setInspectionNotePdfUrl(serviceCase.damageInspectionNotePdfUrl ?? null);
    setInspectionNoteFileName(serviceCase.damageInspectionNoteFileName ?? null);
    setInspectionNoteIssuedOn(serviceCase.damageInspectionNoteIssuedOn ?? "");
    setInspectionNoteNotes(serviceCase.damageInspectionNoteNotes ?? "");
    setInspectionNotesHistory(serviceCase.damageInspectionNotes ?? []);
    setPaymentAcceptancePdfUrl(serviceCase.damagePaymentAcceptancePdfUrl ?? null);
    setPaymentAcceptanceFileName(serviceCase.damagePaymentAcceptanceFileName ?? null);
    setPaymentAcceptanceNotes(serviceCase.damagePaymentAcceptanceNotes ?? "");
    const mergedDocs = mergeDamageDocuments(
      documentKindsForInsurance(serviceCase.damageInsuranceType),
      serviceCase.damageDocuments,
    );
    setDocs(mergedDocs);
    const nextPhotos = serviceCase.damagePhotos ?? [];
    setPhotos(nextPhotos);
    setLocks(serviceCase.damageSectionLocks ?? {});
    setAvizareDocIds(
      new Set(
        mergedDocs
          .filter((d) => d.url || d.received || (d.kind === "itp_expiry" && d.expiresOn))
          .map((d) => d.id),
      ),
    );
    setAvizarePhotoIds(
      new Set(
        nextPhotos
          .filter((p) => p.kind === "exterior" || p.kind === "damage_detail" || p.kind === "odometer")
          .map((p) => p.id),
      ),
    );
    setReinspectionPhotoIds(
      new Set(nextPhotos.filter((p) => p.kind === "damage_detail").map((p) => p.id)),
    );
  }, [serviceCase]);

  useEffect(() => {
    if (!isDamage) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${insurersBrowserBase}?active=true&pageSize=200`, {
          headers: fleetJsonHeaders(),
        });
        if (!res.ok || cancelled) return;
        const payload = (await res.json()) as { items?: InsurerRecord[] };
        if (!cancelled) setInsurerCatalog(payload.items ?? []);
      } catch {
        /* catalog optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isDamage]);

  useEffect(() => {
    setDocs((prev) => mergeDamageDocuments(documentKindsForInsurance(insuranceType), prev));
  }, [insuranceType]);

  const agreedAt = serviceCase?.damageInsurerAgreedAt ?? null;
  const insurerReady = isDamageInsurerReady({
    damagePayerType: payer || serviceCase?.damagePayerType,
    damageInsurerPipelineStatus: pipeline || serviceCase?.damageInsurerPipelineStatus,
    damageInsurerAgreedAt: agreedAt,
  });
  const docsReceived = useMemo(
    () =>
      docs.filter((d) => {
        if (d.kind === "itp_expiry") return !!(d.expiresOn || d.url || d.received);
        return !!(d.url || d.received);
      }).length,
    [docs],
  );
  const initialPhotos = useMemo(
    () => photos.filter((p) => p.kind !== "repaired"),
    [photos],
  );
  const repairedPhotos = useMemo(
    () => photos.filter((p) => p.kind === "repaired"),
    [photos],
  );
  const reinspectionLog = useMemo(
    () => mailLog.filter((m) => m.kind === "reinspection"),
    [mailLog],
  );
  const lastAvizare = useMemo(
    () => mailLog.find((m) => m.kind === "avizare" && m.status !== "failed") ?? null,
    [mailLog],
  );
  const inspectionPdfDocs = useMemo(
    () => inspectionNotesHistory.filter(isInspectionPdfDoc),
    [inspectionNotesHistory],
  );
  const reinspectionRequests = useMemo(
    () =>
      inspectionNotesHistory
        .filter(isReinspectionRequest)
        .sort((a, b) => b.sequence - a.sequence),
    [inspectionNotesHistory],
  );
  const primaryWo = serviceCase?.workOrders?.[0] ?? null;
  const primaryQuote =
    primaryWo?.latestQuote ?? primaryWo?.approvedQuote ?? primaryWo?.pendingQuote ?? null;
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
    let franchiseCents: number | null = null;
    if (franchiseRon.trim()) {
      const n = Number(franchiseRon.replace(",", "."));
      if (!Number.isFinite(n) || n < 0) {
        setError("Franciza CASCO trebuie să fie un număr ≥ 0.");
        return;
      }
      franchiseCents = Math.round(n * 100);
    }
    const showFranchise = insuranceType === "CASCO" || insuranceType === "BOTH";
    await patch(
      {
        vehicleMovable: movable || null,
        damagePayerType: payer || null,
        damageInsuranceType: insuranceType || null,
        damageClaimNumber: claimNumber.trim() || null,
        damageInsurerId: insurerId.trim() || null,
        damageInsurerName: insurerName.trim() || null,
        damageClaimStatus: claimStatus,
        damageInsurerAgreementNotes: agreementNotes.trim() || null,
        damageCascoFranchiseCents: showFranchise ? franchiseCents : null,
        damageInsurerEmail: insurerEmail.trim() || null,
        damageQuoteOrigin: quoteOrigin || null,
      },
      "Informații dosar salvate.",
    );
  }

  async function saveDocuments() {
    await patch({ damageDocuments: docs }, "Documente salvate.");
  }

  async function importFromFleet(doc: DamageDocumentItem) {
    const plate = registrationNumber?.trim();
    if (!plate && doc.kind !== "itp_expiry") {
      setError("Lipsește numărul de înmatriculare — nu pot importa din Documente flotă.");
      return;
    }
    if (!plate && !serviceCase?.vehicleId) {
      setError("Lipsește nr. înmatriculare / vehicul — nu pot importa ITP din flotă.");
      return;
    }
    const fleetType = DAMAGE_KIND_TO_FLEET_DOC[doc.kind as DamageDocumentKind];
    if (!fleetType) return;
    setImportingKind(doc.kind);
    setError(null);
    setOk(null);
    try {
      const toDay = (raw: string | null | undefined): string | undefined => {
        if (!raw?.trim()) return undefined;
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) {
          const m = raw.trim().match(/^(\d{4}-\d{2}-\d{2})/);
          return m?.[1];
        }
        return d.toISOString().slice(0, 10);
      };

      let fileUrl: string | undefined;
      let fileName: string | undefined;
      let expiresOn: string | undefined;

      if (plate) {
        const q = new URLSearchParams({
          page: "1",
          pageSize: "100",
          registrationNumber: plate,
        });
        const res = await fetch(`${documentsBrowserBase}?${q.toString()}`, {
          headers: fleetJsonHeaders(),
        });
        if (!res.ok) {
          setError(`Nu am putut citi Documente flotă (HTTP ${res.status}).`);
          return;
        }
        const payload = (await res.json()) as {
          items?: Array<{
            documentTypeCode: string;
            fileUrl: string | null;
            fileName: string | null;
            expiresOn: string | null;
            createdAt: string;
            title?: string;
          }>;
        };
        const typed = (payload.items ?? [])
          .filter((i) => i.documentTypeCode === fleetType)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

        if (doc.kind === "itp_expiry") {
          const withDate = typed.find((i) => i.expiresOn) ?? typed[0];
          if (withDate) {
            expiresOn = toDay(withDate.expiresOn);
            if (withDate.fileUrl) {
              fileUrl = withDate.fileUrl;
              fileName = withDate.fileName ?? withDate.title ?? undefined;
            }
          }
        } else {
          const withFile = typed.find((i) => i.fileUrl);
          if (!withFile?.fileUrl) {
            setError(
              `Nu există ${doc.label ?? doc.kind} cu fișier pe ${plate} în Documente flotă.`,
            );
            return;
          }
          fileUrl = withFile.fileUrl;
          fileName = withFile.fileName ?? withFile.title ?? undefined;
          expiresOn = toDay(withFile.expiresOn);
        }
      }

      // ITP: dacă nu avem dată din document, luăm itpExpiresOn de pe vehicul.
      if (doc.kind === "itp_expiry" && !expiresOn && serviceCase?.vehicleId) {
        const vRes = await fetch(`${fleetBrowserBase}/vehicles/${serviceCase.vehicleId}`, {
          headers: fleetJsonHeaders(),
        });
        if (vRes.ok) {
          const vehicle = (await vRes.json()) as { itpExpiresOn?: string | null };
          expiresOn = toDay(vehicle.itpExpiresOn ?? undefined);
        }
      }

      if (doc.kind === "itp_expiry") {
        if (!expiresOn && !fileUrl) {
          setError(
            `Nu am găsit data expirare ITP pe ${plate || "vehicul"} în flotă (nici pe document, nici pe profil).`,
          );
          return;
        }
      }

      const nextDocs = docs.map((d) =>
        d.kind === doc.kind
          ? {
              ...d,
              ...(fileUrl
                ? { url: fileUrl, fileName }
                : doc.kind === "itp_expiry"
                  ? {}
                  : { url: fileUrl, fileName }),
              ...(expiresOn ? { expiresOn } : {}),
              received: true,
              notes:
                doc.kind === "itp_expiry" && expiresOn
                  ? d.notes?.trim()
                    ? d.notes
                    : `Expiră ${expiresOn}`
                  : d.notes,
              uploadedAt: new Date().toISOString(),
            }
          : d,
      );
      setDocs(nextDocs);
      setAvizareDocIds((prev) => {
        const next = new Set(prev);
        next.add(doc.id);
        return next;
      });
      await patch(
        { damageDocuments: nextDocs },
        doc.kind === "itp_expiry" && expiresOn && !fileUrl
          ? `Importată data ITP din flotă: ${expiresOn}.`
          : `Importat din Documente flotă: ${doc.label ?? doc.kind}.`,
      );
    } finally {
      setImportingKind(null);
    }
  }

  async function sendAvizare() {
    if (!serviceCase) return;
    if (!insurerEmail.trim()) {
      setError("Completează emailul asigurătorului pe dosar înainte de avizare.");
      return;
    }
    if (avizareDocIds.size === 0 && avizarePhotoIds.size === 0) {
      setError("Bifează cel puțin un document sau o poză pentru avizare.");
      return;
    }
    setPending(true);
    setError(null);
    setOk(null);
    try {
      // Persist email if edited locally
      await fetch(`${serviceCasesBrowserBase}/${serviceCase.id}/damage-claim`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({ damageInsurerEmail: insurerEmail.trim() || null }),
      });
      const res = await fetch(
        `${serviceCasesBrowserBase}/${serviceCase.id}/damage-claim/send-avizare`,
        {
          method: "POST",
          headers: fleetJsonHeaders(),
          body: JSON.stringify({
            documentIds: [...avizareDocIds],
            photoIds: [...avizarePhotoIds],
            note: avizareNote.trim() || null,
          }),
        },
      );
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (j.message) msg = Array.isArray(j.message) ? j.message.join(", ") : j.message;
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      const next = (await res.json()) as ServiceCaseRecord;
      onUpdated?.(next);
      setMailLog(next.damageInsurerMailLog ?? []);
      setPipeline(next.damageInsurerPipelineStatus ?? "notified");
      setOk(
        next.damageInsurerMailLog?.[0]?.status === "stubbed"
          ? "Avizare înregistrată (SMTP neconfigurat) — verifică logul / linkurile din email."
          : "Avizare trimisă către asigurător.",
      );
    } finally {
      setPending(false);
    }
  }

  async function savePipeline() {
    if (!pipeline) {
      setError("Alege un pas din pipeline.");
      return;
    }
    await patch(
      { damageInsurerPipelineStatus: pipeline },
      pipeline === "payment_accepted"
        ? "Accept plată înregistrat — reparația (În lucru) poate continua după aprobare / post-approval (și mobilitate)."
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
          . Mai e nevoie de mașină la schimb înainte de reparație (În lucru).
        </div>
      ) : isClientPayer ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 px-3 py-2 text-sm text-amber-100">
          Confirmă plătitorul client ca să deblochezi reparația (împreună cu mobilitatea).
        </div>
      ) : (
        <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 px-3 py-2 text-sm text-amber-100">
          Reparația (status <strong>În lucru</strong>) cere <strong>Accept plată</strong> (pipeline) +
          mașină la schimb
          {movable === "immovable" ? "; recepția In service cere asistență rutieră activă" : ""}.
          Recepția vehiculului (In service) nu e blocată de pipeline.
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
            <span className={OPS_LABEL_CLASS}>Asigurător (catalog)</span>
            <select
              className={OPS_INPUT_CLASS}
              disabled={disabled || sectionLocked("claim_info") || isClientPayer}
              value={insurerId}
              onChange={(e) => {
                const id = e.target.value;
                setInsurerId(id);
                const hit = insurerCatalog.find((i) => i.id === id);
                if (hit) {
                  setInsurerName(hit.name);
                  if (hit.email) setInsurerEmail(hit.email);
                }
              }}
            >
              <option value="">— text liber / necunoscut —</option>
              {insurerCatalog.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                  {i.email ? ` (${i.email})` : ""}
                </option>
              ))}
            </select>
            <span className="mt-0.5 block text-[10px] text-zinc-500">
              Catalog: Flotă → Asigurători. Poți lăsa gol și completa nume/email liber.
            </span>
          </label>
          <label className="block">
            <span className={OPS_LABEL_CLASS}>Nume pe dosar</span>
            <input
              className={OPS_INPUT_CLASS}
              disabled={disabled || sectionLocked("claim_info") || isClientPayer}
              value={insurerName}
              onChange={(e) => setInsurerName(e.target.value)}
              placeholder="Nume societate"
            />
          </label>
          <label className="block">
            <span className={OPS_LABEL_CLASS}>Email asigurător</span>
            <input
              type="email"
              className={OPS_INPUT_CLASS}
              disabled={disabled || sectionLocked("claim_info") || isClientPayer}
              value={insurerEmail}
              onChange={(e) => setInsurerEmail(e.target.value)}
              placeholder="claims@asigurator.ro"
            />
          </label>
          {insuranceType === "CASCO" || insuranceType === "BOTH" ? (
            <label className="block sm:col-span-2">
              <span className={OPS_LABEL_CLASS}>Franciză CASCO (RON)</span>
              <input
                className={OPS_INPUT_CLASS}
                inputMode="decimal"
                disabled={disabled || sectionLocked("claim_info")}
                value={franchiseRon}
                onChange={(e) => setFranchiseRon(e.target.value)}
                placeholder="ex. 500.00"
              />
              <span className="mt-0.5 block text-[10px] text-zinc-500">
                Sumă plătită de client (utilizator) conform poliței — menționată pe dosar, nu pe
                plătitorul asigurător.
              </span>
            </label>
          ) : null}
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
                  <div className="flex min-w-[10rem] flex-1 flex-col gap-0.5">
                    <span className="text-sm text-zinc-200">{doc.label ?? doc.kind}</span>
                    <span
                      className={`text-[10px] ${
                        doc.kind === "itp_expiry"
                          ? doc.expiresOn || doc.url
                            ? "text-emerald-400"
                            : "text-zinc-500"
                          : doc.url
                            ? "text-emerald-400"
                            : "text-zinc-500"
                      }`}
                    >
                      {doc.kind === "itp_expiry"
                        ? doc.expiresOn
                          ? `Expiră ${doc.expiresOn}${doc.url ? " · cu fișier" : ""}`
                          : doc.url
                            ? "Cu fișier (fără dată)"
                            : "Importă data din flotă sau încarcă certificat"
                        : doc.url
                          ? "Cu fișier"
                          : "Fără fișier — încarcă sau importă din flotă"}
                    </span>
                  </div>
                  {doc.kind === "itp_expiry" ? (
                    <label className="block">
                      <span className="sr-only">Data expirare ITP</span>
                      <input
                        type="date"
                        className={`${OPS_INPUT_CLASS} w-[9.5rem] py-1.5 text-xs`}
                        disabled={disabled || sectionLocked("documents")}
                        value={doc.expiresOn ?? ""}
                        onChange={(e) => {
                          const expiresOn = e.target.value || undefined;
                          setDocs((prev) =>
                            prev.map((d) =>
                              d.kind === doc.kind
                                ? {
                                    ...d,
                                    expiresOn,
                                    received: !!(expiresOn || d.url),
                                    notes: expiresOn
                                      ? d.notes?.startsWith("Expiră ")
                                        ? `Expiră ${expiresOn}`
                                        : d.notes
                                      : d.notes,
                                  }
                                : d,
                            ),
                          );
                        }}
                      />
                    </label>
                  ) : null}
                  <input
                    className={`${OPS_INPUT_CLASS} max-w-[10rem] flex-1 py-1.5 text-xs`}
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
                  {doc.url ? (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="max-w-[8rem] truncate text-xs text-emerald-400 hover:underline"
                      title={doc.fileName ?? doc.url}
                    >
                      {doc.fileName ?? "Fișier"}
                    </a>
                  ) : null}
                  {canWrite && !sectionLocked("documents") ? (
                    <>
                      <label className="cursor-pointer rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800">
                        {uploading ? "…" : doc.url ? "Înlocuiește" : "Încarcă"}
                        <input
                          type="file"
                          accept="application/pdf,image/*,.doc,.docx"
                          className="hidden"
                          disabled={disabled || uploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            void (async () => {
                              setUploading(true);
                              setError(null);
                              try {
                                const up = await uploadDocumentFile(
                                  file,
                                  doc.label ?? doc.kind,
                                );
                                const nextDocs = docs.map((d) =>
                                  d.kind === doc.kind
                                    ? {
                                        ...d,
                                        url: up.url,
                                        fileName: up.name,
                                        received: true,
                                        uploadedAt: new Date().toISOString(),
                                      }
                                    : d,
                                );
                                setDocs(nextDocs);
                                await patch(
                                  { damageDocuments: nextDocs },
                                  `Document încărcat: ${doc.label ?? doc.kind}.`,
                                );
                              } catch (err) {
                                setError(err instanceof Error ? err.message : "Upload eșuat.");
                              } finally {
                                setUploading(false);
                                e.target.value = "";
                              }
                            })();
                          }}
                        />
                      </label>
                      {doc.url ? (
                        <button
                          type="button"
                          disabled={pending}
                          className="text-[11px] text-rose-400 hover:underline disabled:opacity-50"
                          onClick={() => {
                            const nextDocs = docs.map((d) =>
                              d.kind === doc.kind
                                ? { ...d, url: undefined, fileName: undefined, received: false }
                                : d,
                            );
                            setDocs(nextDocs);
                            void patch({ damageDocuments: nextDocs }, "Fișier șters de pe document.");
                          }}
                        >
                          Șterge fișier
                        </button>
                      ) : null}
                      {DAMAGE_KIND_TO_FLEET_DOC[doc.kind as DamageDocumentKind] ? (
                        <button
                          type="button"
                          disabled={
                            pending ||
                            importingKind === doc.kind ||
                            (!registrationNumber?.trim() &&
                              !(doc.kind === "itp_expiry" && serviceCase?.vehicleId))
                          }
                          title={
                            doc.kind === "itp_expiry"
                              ? "Importă data ITP din flotă (fișier opțional)"
                              : registrationNumber?.trim()
                                ? "Copiază fișierul din Documente flotă"
                                : "Lipsește nr. înmatriculare"
                          }
                          className="text-[11px] text-sky-400 hover:underline disabled:opacity-50"
                          onClick={() => void importFromFleet(doc)}
                        >
                          {importingKind === doc.kind
                            ? "Import…"
                            : doc.kind === "itp_expiry"
                              ? "Dată din flotă"
                              : "Din flotă"}
                        </button>
                      ) : null}
                    </>
                  ) : null}
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

      {/* Photos — initial damage gallery */}
      <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/30 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Galerie poze ({initialPhotos.length})
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
        {initialPhotos.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {initialPhotos.map((p) => (
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
                {DAMAGE_PHOTO_KINDS_INITIAL.map((k) => (
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
      </section>

      {/* Avizare — select docs + photos → send to insurer */}
      {!isClientPayer ? (
        <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/30 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Avizare</h4>
          <p className="text-[11px] text-zinc-500">
            Bifează documentele și pozele din dosar, apoi trimite pachetul pe emailul asigurătorului
            (linkuri către fișiere).
          </p>
          {lastAvizare ? (
            <div className="rounded-md border border-emerald-700/40 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-100">
              <span className="font-medium">Avizare trimisă</span>
              {" · "}
              {new Date(lastAvizare.at).toLocaleString("ro-RO", {
                dateStyle: "short",
                timeStyle: "short",
              })}
              {" → "}
              {lastAvizare.to}
              {" · "}
              <span
                className={
                  lastAvizare.status === "sent"
                    ? "text-emerald-300"
                    : lastAvizare.status === "stubbed"
                      ? "text-amber-300"
                      : "text-rose-300"
                }
              >
                {lastAvizare.status}
              </span>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className={`${OPS_LABEL_CLASS} mb-1`}>Documente</p>
              {docs.length ? (
                <ul className="max-h-48 space-y-1 overflow-y-auto rounded border border-zinc-800 bg-zinc-950/40 p-2">
                  {docs.map((d) => (
                    <li key={d.id}>
                      <label className="flex items-start gap-2 text-xs text-zinc-300">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          disabled={disabled || !canWrite}
                          checked={avizareDocIds.has(d.id)}
                          onChange={(e) => {
                            setAvizareDocIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(d.id);
                              else next.delete(d.id);
                              return next;
                            });
                          }}
                        />
                        <span>
                          {d.label ?? d.kind}
                          {!d.url ? (
                            <span className="ml-1 text-zinc-600">(fără fișier)</span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-zinc-500">Niciun document pe checklist.</p>
              )}
            </div>
            <div>
              <p className={`${OPS_LABEL_CLASS} mb-1`}>Poze</p>
              {photos.length ? (
                <ul className="max-h-48 space-y-1 overflow-y-auto rounded border border-zinc-800 bg-zinc-950/40 p-2">
                  {photos.map((p) => (
                    <li key={p.id}>
                      <label className="flex items-start gap-2 text-xs text-zinc-300">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          disabled={disabled || !canWrite}
                          checked={avizarePhotoIds.has(p.id)}
                          onChange={(e) => {
                            setAvizarePhotoIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(p.id);
                              else next.delete(p.id);
                              return next;
                            });
                          }}
                        />
                        <span>
                          {DAMAGE_PHOTO_KINDS.find((k) => k.kind === p.kind)?.label ?? p.kind}
                          {p.caption ? ` · ${p.caption}` : ""}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-zinc-500">Nicio poză în galerie.</p>
              )}
            </div>
          </div>
          <label className="block">
            <span className={OPS_LABEL_CLASS}>Notă avizare (opțional)</span>
            <input
              className={OPS_INPUT_CLASS}
              disabled={disabled || !canWrite}
              value={avizareNote}
              onChange={(e) => setAvizareNote(e.target.value)}
              placeholder="ex. solicităm constatare / urgență"
            />
          </label>
          {canWrite ? (
            <button
              type="button"
              disabled={
                pending ||
                (!avizareDocIds.size && !avizarePhotoIds.size) ||
                !insurerEmail.trim()
              }
              onClick={() => void sendAvizare()}
              className={
                lastAvizare
                  ? "rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                  : "rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              }
            >
              {lastAvizare ? "Retrimite avizare" : "Trimite avizare"}
            </button>
          ) : null}
          {!insurerEmail.trim() ? (
            <p className="text-[11px] text-amber-400/90">
              Completează emailul asigurătorului în informațiile dosarului.
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Notă de constatare — emisă doar de asigurător */}
      {!isClientPayer ? (
        <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/30 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Notă de constatare
          </h4>
          <p className="text-[11px] text-zinc-500">
            Document emis exclusiv de asigurător. Încarcă PDF-ul primit pe mail. Pentru daune ușoare
            constatarea e adesea pe poze; pentru daune serioase, un inspector se deplasează la
            partener.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={OPS_LABEL_CLASS}>Mod constatare</span>
              <select
                className={OPS_INPUT_CLASS}
                disabled={disabled}
                value={inspectionMode}
                onChange={(e) => setInspectionMode(e.target.value as DamageInspectionMode | "")}
              >
                <option value="">—</option>
                <option value="photos">Pe baza pozelor / documentelor</option>
                <option value="on_site">Inspector la partener</option>
              </select>
            </label>
            <label className="block">
              <span className={OPS_LABEL_CLASS}>Data emiterii (opțional)</span>
              <input
                type="date"
                className={OPS_INPUT_CLASS}
                disabled={disabled}
                value={inspectionNoteIssuedOn}
                onChange={(e) => setInspectionNoteIssuedOn(e.target.value)}
              />
            </label>
          </div>
          <label className="block">
            <span className={OPS_LABEL_CLASS}>Notă internă / nr. referință (opțional)</span>
            <input
              className={OPS_INPUT_CLASS}
              disabled={disabled}
              value={inspectionNoteNotes}
              onChange={(e) => setInspectionNoteNotes(e.target.value)}
              placeholder="ex. nr. dosar constatare asigurător"
            />
          </label>
          {inspectionPdfDocs.length ? (
            <ul className="space-y-1.5 rounded border border-zinc-800 bg-zinc-950/40 p-2">
              <li className="text-[10px] uppercase tracking-wide text-zinc-500">
                Istoric documente constatare ({inspectionPdfDocs.length})
              </li>
              {inspectionPdfDocs.map((n) => (
                <li key={n.id} className="flex flex-wrap items-center gap-2 text-xs text-zinc-300">
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                    {n.kind === "pvs" ? `PVS${n.sequence ?? ""}` : "Notă"}
                  </span>
                  <a
                    href={n.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 hover:underline"
                  >
                    {n.fileName ?? "PDF"}
                  </a>
                  <span className="text-zinc-500">
                    {new Date(n.receivedAt).toLocaleString("ro-RO", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                  {n.mode ? (
                    <span className="text-zinc-500">
                      · {n.mode === "on_site" ? "inspector" : "pe poze"}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : inspectionNotePdfUrl ? (
            <p className="text-xs text-zinc-300">
              PDF pe dosar:{" "}
              <a
                href={inspectionNotePdfUrl}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 hover:underline"
              >
                {inspectionNoteFileName ?? "deschide"}
              </a>
            </p>
          ) : (
            <p className="text-xs text-amber-400/90">Așteptăm nota de la asigurător.</p>
          )}
          {canWrite ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  void patch(
                    {
                      damageInspectionMode: inspectionMode || null,
                      damageInspectionNoteIssuedOn: inspectionNoteIssuedOn.trim() || null,
                      damageInspectionNoteNotes: inspectionNoteNotes.trim() || null,
                    },
                    "Date constatare salvate.",
                  )
                }
                className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
              >
                Salvează constatare
              </button>
              <label className="cursor-pointer rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800">
                {uploading
                  ? "Se încarcă…"
                  : inspectionPdfDocs.length || inspectionNotePdfUrl
                    ? "Adaugă PDF notă"
                    : "Încarcă PDF notă"}
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  disabled={disabled || uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void (async () => {
                      setUploading(true);
                      setError(null);
                      try {
                        const up = await uploadDocumentFile(file, "Notă constatare asigurător");
                        const next = await patch(
                          {
                            damageInspectionMode: inspectionMode || null,
                            damageInspectionNotePdfUrl: up.url,
                            damageInspectionNoteFileName: up.name,
                            damageInspectionNoteIssuedOn: inspectionNoteIssuedOn.trim() || null,
                            damageInspectionNoteNotes: inspectionNoteNotes.trim() || null,
                            damageInspectionDocKind: "inspection_note",
                          },
                          "Notă de constatare înregistrată pe dosar.",
                        );
                        if (next) {
                          setInspectionNotePdfUrl(next.damageInspectionNotePdfUrl ?? up.url);
                          setInspectionNoteFileName(
                            next.damageInspectionNoteFileName ?? up.name,
                          );
                          setInspectionNotesHistory(next.damageInspectionNotes ?? []);
                          setPipeline(next.damageInsurerPipelineStatus ?? "inspection_note");
                        }
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Upload eșuat.");
                      } finally {
                        setUploading(false);
                        e.target.value = "";
                      }
                    })();
                  }}
                />
              </label>
            </div>
          ) : null}
          {canWrite ? (
            <div className="space-y-3 border-t border-zinc-800 pt-3">
              <p className="text-[11px] text-zinc-500">
                Solicitare reconstatare pe mail (poze + explicații). Asigurătorul poate aproba sau
                respinge; la aprobare încarci PVS (PVS1, PVS2…).
              </p>
              {reinspectionRequests.length ? (
                <ul className="space-y-2">
                  {reinspectionRequests.map((req) => (
                    <li
                      key={req.id}
                      className="space-y-2 rounded border border-zinc-800 bg-zinc-950/40 p-2 text-xs"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-zinc-500">#{req.sequence}</span>
                        <span
                          className={
                            req.status === "pending"
                              ? "rounded bg-amber-950/50 px-1.5 py-0.5 text-amber-200"
                              : req.status === "approved"
                                ? "rounded bg-emerald-950/50 px-1.5 py-0.5 text-emerald-200"
                                : "rounded bg-rose-950/50 px-1.5 py-0.5 text-rose-200"
                          }
                        >
                          {req.status === "pending"
                            ? "În așteptare"
                            : req.status === "approved"
                              ? "Aprobată"
                              : "Respinsă"}
                        </span>
                        <span className="text-zinc-500">
                          {new Date(req.sentAt).toLocaleString("ro-RO", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </span>
                      </div>
                      <p className="text-zinc-300">{req.explanation}</p>
                      {req.photoIds.length ? (
                        <p className="text-[10px] text-zinc-500">
                          {req.photoIds.length} poză(e) în pachet
                        </p>
                      ) : null}
                      {req.status === "rejected" && req.rejectionReason ? (
                        <p className="text-rose-300/90">Refuz: {req.rejectionReason}</p>
                      ) : null}
                      {req.status === "pending" ? (
                        <div className="flex flex-wrap items-end gap-2">
                          <button
                            type="button"
                            disabled={pending}
                            className="rounded border border-emerald-700/50 px-2 py-1 text-emerald-200 hover:bg-emerald-950/40 disabled:opacity-50"
                            onClick={() => {
                              void (async () => {
                                setPending(true);
                                setError(null);
                                try {
                                  const res = await fetch(
                                    `${serviceCasesBrowserBase}/${serviceCase!.id}/damage-claim/decide-reinspection`,
                                    {
                                      method: "POST",
                                      headers: fleetJsonHeaders(),
                                      body: JSON.stringify({
                                        requestId: req.id,
                                        decision: "approved",
                                      }),
                                    },
                                  );
                                  if (!res.ok) {
                                    let msg = `HTTP ${res.status}`;
                                    try {
                                      const j = (await res.json()) as {
                                        message?: string | string[];
                                      };
                                      if (j.message)
                                        msg = Array.isArray(j.message)
                                          ? j.message.join(", ")
                                          : j.message;
                                    } catch {
                                      /* ignore */
                                    }
                                    setError(msg);
                                    return;
                                  }
                                  const next = (await res.json()) as ServiceCaseRecord;
                                  onUpdated?.(next);
                                  setInspectionNotesHistory(next.damageInspectionNotes ?? []);
                                  setPipeline(next.damageInsurerPipelineStatus ?? pipeline);
                                  setOk("Reconstatare marcată ca aprobată — încarcă PVS.");
                                } finally {
                                  setPending(false);
                                }
                              })();
                            }}
                          >
                            Aprobată
                          </button>
                          <label className="min-w-[12rem] flex-1">
                            <span className={OPS_LABEL_CLASS}>Motiv refuz</span>
                            <input
                              className={OPS_INPUT_CLASS}
                              disabled={disabled}
                              value={rejectionDrafts[req.id] ?? ""}
                              onChange={(e) =>
                                setRejectionDrafts((prev) => ({
                                  ...prev,
                                  [req.id]: e.target.value,
                                }))
                              }
                              placeholder="obligatoriu la respingere"
                            />
                          </label>
                          <button
                            type="button"
                            disabled={pending || !(rejectionDrafts[req.id]?.trim().length)}
                            className="rounded border border-rose-700/50 px-2 py-1 text-rose-200 hover:bg-rose-950/40 disabled:opacity-50"
                            onClick={() => {
                              void (async () => {
                                setPending(true);
                                setError(null);
                                try {
                                  const res = await fetch(
                                    `${serviceCasesBrowserBase}/${serviceCase!.id}/damage-claim/decide-reinspection`,
                                    {
                                      method: "POST",
                                      headers: fleetJsonHeaders(),
                                      body: JSON.stringify({
                                        requestId: req.id,
                                        decision: "rejected",
                                        rejectionReason: rejectionDrafts[req.id]?.trim() || null,
                                      }),
                                    },
                                  );
                                  if (!res.ok) {
                                    let msg = `HTTP ${res.status}`;
                                    try {
                                      const j = (await res.json()) as {
                                        message?: string | string[];
                                      };
                                      if (j.message)
                                        msg = Array.isArray(j.message)
                                          ? j.message.join(", ")
                                          : j.message;
                                    } catch {
                                      /* ignore */
                                    }
                                    setError(msg);
                                    return;
                                  }
                                  const next = (await res.json()) as ServiceCaseRecord;
                                  onUpdated?.(next);
                                  setInspectionNotesHistory(next.damageInspectionNotes ?? []);
                                  setPipeline(next.damageInsurerPipelineStatus ?? pipeline);
                                  setOk("Reconstatare marcată ca respinsă.");
                                } finally {
                                  setPending(false);
                                }
                              })();
                            }}
                          >
                            Respinsă
                          </button>
                        </div>
                      ) : null}
                      {req.status === "approved" && !req.linkedPvsId ? (
                        <label className="inline-block cursor-pointer rounded border border-sky-700/50 px-2 py-1 text-sky-200 hover:bg-sky-950/30">
                          {uploading ? "Se încarcă…" : "Încarcă PVS"}
                          <input
                            type="file"
                            accept="application/pdf,image/*"
                            className="hidden"
                            disabled={disabled || uploading}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              void (async () => {
                                setUploading(true);
                                setError(null);
                                try {
                                  const up = await uploadDocumentFile(
                                    file,
                                    `PVS reconstatare #${req.sequence}`,
                                  );
                                  const next = await patch(
                                    {
                                      damageInspectionNotePdfUrl: up.url,
                                      damageInspectionNoteFileName: up.name,
                                      damageInspectionDocKind: "pvs",
                                      damagePvsLinkedRequestId: req.id,
                                    },
                                    `PVS înregistrat pentru reconstatare #${req.sequence}.`,
                                  );
                                  if (next) {
                                    setInspectionNotePdfUrl(
                                      next.damageInspectionNotePdfUrl ?? up.url,
                                    );
                                    setInspectionNotesHistory(next.damageInspectionNotes ?? []);
                                    setPipeline(
                                      next.damageInsurerPipelineStatus ?? "inspection_note",
                                    );
                                  }
                                } catch (err) {
                                  setError(err instanceof Error ? err.message : "Upload eșuat.");
                                } finally {
                                  setUploading(false);
                                  e.target.value = "";
                                }
                              })();
                            }}
                          />
                        </label>
                      ) : null}
                      {req.linkedPvsId ? (
                        <p className="text-[10px] text-emerald-400/90">PVS legat pe dosar.</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : reinspectionLog.length ? (
                <ul className="space-y-1 text-[11px] text-zinc-400">
                  {reinspectionLog.map((m, idx) => (
                    <li key={m.id}>
                      Mail #{reinspectionLog.length - idx} ·{" "}
                      {new Date(m.at).toLocaleString("ro-RO", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}{" "}
                      · {m.status}
                      {m.note ? ` · ${m.note}` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
              <label className="block">
                <span className={OPS_LABEL_CLASS}>Explicații reconstatare</span>
                <textarea
                  className={`${OPS_INPUT_CLASS} min-h-[4rem]`}
                  disabled={disabled}
                  value={reinspectionNote}
                  onChange={(e) => setReinspectionNote(e.target.value)}
                  placeholder="Descrie de ce e nevoie de reconstatare (obligatoriu)"
                />
              </label>
              {photos.length ? (
                <div>
                  <p className={`${OPS_LABEL_CLASS} mb-1`}>Poze în pachet</p>
                  <ul className="max-h-36 space-y-1 overflow-y-auto rounded border border-zinc-800 bg-zinc-950/40 p-2">
                    {photos.map((p) => (
                      <li key={p.id}>
                        <label className="flex items-start gap-2 text-xs text-zinc-300">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            disabled={disabled}
                            checked={reinspectionPhotoIds.has(p.id)}
                            onChange={(e) => {
                              setReinspectionPhotoIds((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(p.id);
                                else next.delete(p.id);
                                return next;
                              });
                            }}
                          />
                          <span>
                            {DAMAGE_PHOTO_KINDS.find((k) => k.kind === p.kind)?.label ?? p.kind}
                            {p.caption ? ` · ${p.caption}` : ""}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-[11px] text-zinc-500">
                  Adaugă poze în galerie ca să le incluzi în solicitare.
                </p>
              )}
              <button
                type="button"
                disabled={
                  pending || !insurerEmail.trim() || reinspectionNote.trim().length < 5
                }
                onClick={() => {
                  void (async () => {
                    setPending(true);
                    setError(null);
                    setOk(null);
                    try {
                      const res = await fetch(
                        `${serviceCasesBrowserBase}/${serviceCase!.id}/damage-claim/request-reinspection`,
                        {
                          method: "POST",
                          headers: fleetJsonHeaders(),
                          body: JSON.stringify({
                            note: reinspectionNote.trim(),
                            photoIds: [...reinspectionPhotoIds],
                          }),
                        },
                      );
                      if (!res.ok) {
                        let msg = `HTTP ${res.status}`;
                        try {
                          const j = (await res.json()) as { message?: string | string[] };
                          if (j.message)
                            msg = Array.isArray(j.message) ? j.message.join(", ") : j.message;
                        } catch {
                          /* ignore */
                        }
                        setError(msg);
                        return;
                      }
                      const next = (await res.json()) as ServiceCaseRecord;
                      onUpdated?.(next);
                      setMailLog(next.damageInsurerMailLog ?? []);
                      setInspectionNotesHistory(next.damageInspectionNotes ?? []);
                      setPipeline(next.damageInsurerPipelineStatus ?? "reinspection_requested");
                      setReinspectionNote("");
                      setOk(
                        next.damageInsurerMailLog?.[0]?.status === "stubbed"
                          ? "Reconstatare înregistrată (SMTP neconfigurat)."
                          : "Reconstatare solicitată către asigurător.",
                      );
                    } finally {
                      setPending(false);
                    }
                  })();
                }}
                className="rounded-lg border border-amber-600/50 px-3 py-1.5 text-sm text-amber-100 hover:bg-amber-950/40 disabled:opacity-50"
              >
                Trimite solicitare reconstatare
                {reinspectionRequests.length
                  ? ` (#${reinspectionRequests.length + 1})`
                  : ""}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Deviz — 2 căi clare legate de WorkOrderQuote */}
      {!isClientPayer ? (
        <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/30 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Deviz asigurător
          </h4>
          <p className="text-[11px] text-zinc-500">
            Un singur deviz de reparație pe tab Comandă (WorkOrderQuote). Dosarul orientează
            trimiterea sau primirea PDF-ului — nu un al doilea set de linii.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 rounded-md border border-zinc-800 bg-zinc-950/50 p-3">
              <p className="text-xs font-medium text-zinc-200">A. Întocmit de noi</p>
              <p className="text-[11px] text-zinc-500">
                Construiești liniile pe Comandă, apoi trimiți PDF-ul către asigurător de aici.
              </p>
              {primaryWo ? (
                <p className="text-xs text-zinc-300">
                  {fromWorkOrder ? (
                    <span>
                      Comanda curentă
                      {primaryWo.displayNumber ? ` ${primaryWo.displayNumber}` : ""}
                    </span>
                  ) : (
                    <Link
                      href={`/fleet/work-orders/${primaryWo.id}`}
                      className="text-sky-400 hover:underline"
                    >
                      Deschide Comanda
                      {primaryWo.displayNumber ? ` ${primaryWo.displayNumber}` : ""}
                    </Link>
                  )}
                  {primaryQuote ? (
                    <span className="text-zinc-500">
                      {" "}
                      · quote v{primaryQuote.version} · {quoteStatusLabel(primaryQuote.status)}
                    </span>
                  ) : (
                    <span className="text-zinc-500"> · fără quote încă</span>
                  )}
                </p>
              ) : (
                <p className="text-[11px] text-amber-400/90">
                  Nu există încă o comandă legată de dosar.
                </p>
              )}
              <label className="block">
                <span className={OPS_LABEL_CLASS}>Notă la trimitere (opțional)</span>
                <input
                  className={OPS_INPUT_CLASS}
                  disabled={disabled}
                  value={sendNote}
                  onChange={(e) => setSendNote(e.target.value)}
                  placeholder="ex. versiune Audatex 2"
                />
              </label>
              {canWrite ? (
                <button
                  type="button"
                  disabled={pending || !insurerEmail.trim()}
                  onClick={() => {
                    void (async () => {
                      setPending(true);
                      setError(null);
                      setOk(null);
                      try {
                        await patch(
                          {
                            damageQuoteOrigin: "prepared_by_us",
                            damageInsurerEmail: insurerEmail.trim() || null,
                          },
                          "Pregătit pentru trimitere.",
                        );
                        setQuoteOrigin("prepared_by_us");
                        const res = await fetch(
                          `${serviceCasesBrowserBase}/${serviceCase!.id}/damage-claim/send-to-insurer`,
                          {
                            method: "POST",
                            headers: fleetJsonHeaders(),
                            body: JSON.stringify({ note: sendNote.trim() || null }),
                          },
                        );
                        if (!res.ok) {
                          let msg = `HTTP ${res.status}`;
                          try {
                            const j = (await res.json()) as { message?: string | string[] };
                            if (j.message)
                              msg = Array.isArray(j.message) ? j.message.join(", ") : j.message;
                          } catch {
                            /* ignore */
                          }
                          setError(msg);
                          return;
                        }
                        const next = (await res.json()) as ServiceCaseRecord;
                        onUpdated?.(next);
                        setMailLog(next.damageInsurerMailLog ?? []);
                        setPipeline(next.damageInsurerPipelineStatus ?? "quote_ready");
                        setQuoteOrigin(next.damageQuoteOrigin ?? "prepared_by_us");
                        setOk(
                          next.damageInsurerMailLog?.[0]?.status === "stubbed"
                            ? "Înregistrat (SMTP neconfigurat pe server) — verifică logul."
                            : "Deviz trimis către asigurător.",
                        );
                      } finally {
                        setPending(false);
                      }
                    })();
                  }}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  Trimite către asigurător
                </button>
              ) : null}
            </div>
            <div className="space-y-2 rounded-md border border-zinc-800 bg-zinc-950/50 p-3">
              <p className="text-xs font-medium text-zinc-200">B. Primit de la asigurător</p>
              <p className="text-[11px] text-zinc-500">
                Încarcă PDF-ul primit pe mail. Rămâne referință pe dosar (și pe Comandă) — nu
                rescriem automat liniile Audatex.
              </p>
              {insurerPdfUrl ? (
                <p className="text-xs text-zinc-300">
                  PDF pe dosar:{" "}
                  <a
                    href={insurerPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 hover:underline"
                  >
                    deschide
                  </a>
                  {quoteOrigin === "received_from_insurer" ? (
                    <span className="text-zinc-500"> · origine: primit</span>
                  ) : null}
                </p>
              ) : (
                <p className="text-xs text-zinc-500">Niciun PDF încărcat încă.</p>
              )}
              {canWrite ? (
                <label className="inline-block cursor-pointer rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800">
                  {uploading ? "Se încarcă…" : "Încarcă PDF de la asigurător"}
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    disabled={disabled || uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      void (async () => {
                        setUploading(true);
                        setError(null);
                        try {
                          const up = await uploadDocumentFile(file, "Deviz asigurător");
                          const saved = await patch(
                            {
                              damageInsurerQuotePdfUrl: up.url,
                              damageQuoteOrigin: "received_from_insurer",
                              damageInsurerPipelineStatus: "quote_ready",
                            },
                            "PDF asigurător încărcat — pipeline quote_ready.",
                          );
                          if (saved) {
                            setInsurerPdfUrl(saved.damageInsurerQuotePdfUrl ?? up.url);
                            setQuoteOrigin("received_from_insurer");
                            setPipeline(saved.damageInsurerPipelineStatus ?? "quote_ready");
                          }
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Upload eșuat.");
                        } finally {
                          setUploading(false);
                          e.target.value = "";
                        }
                      })();
                    }}
                  />
                </label>
              ) : null}
            </div>
          </div>
          {mailLog.length ? (
            <ul className="space-y-1.5 border-t border-zinc-800 pt-2">
              {mailLog.slice(0, 5).map((m) => (
                <li key={m.id} className="text-[11px] text-zinc-400">
                  <span className="font-mono text-zinc-500">
                    {new Date(m.at).toLocaleString("ro-RO", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                  {" · "}
                  <span
                    className={
                      m.status === "sent"
                        ? "text-emerald-400"
                        : m.status === "failed"
                          ? "text-rose-400"
                          : "text-amber-300"
                    }
                  >
                    {m.status}
                  </span>
                  {" · "}
                  <span className="text-zinc-500">
                    {m.kind === "avizare"
                      ? "avizare"
                      : m.kind === "reinspection"
                        ? "reconstatare"
                        : "deviz"}
                  </span>
                  {" → "}
                  {m.to}
                  {m.pdfUrl ? (
                    <>
                      {" · "}
                      <a
                        href={m.pdfUrl}
                        className="text-sky-400 hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        PDF
                      </a>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {/* Accept plată — document de la asigurător, după Deviz */}
      {!isClientPayer ? (
        <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/30 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Accept plată
          </h4>
          <p className="text-[11px] text-zinc-500">
            Document emis de asigurător (accept / acord plată). Nu e un simplu buton — încarcă PDF-ul
            primit pe mail; pipeline trece la Accept plată.
          </p>
          <label className="block">
            <span className={OPS_LABEL_CLASS}>Notă / nr. referință (opțional)</span>
            <input
              className={OPS_INPUT_CLASS}
              disabled={disabled}
              value={paymentAcceptanceNotes}
              onChange={(e) => setPaymentAcceptanceNotes(e.target.value)}
              placeholder="ex. nr. accept / data"
            />
          </label>
          {paymentAcceptancePdfUrl ? (
            <p className="text-xs text-zinc-300">
              PDF pe dosar:{" "}
              <a
                href={paymentAcceptancePdfUrl}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 hover:underline"
              >
                {paymentAcceptanceFileName ?? "deschide"}
              </a>
            </p>
          ) : (
            <p className="text-xs text-amber-400/90">Așteptăm documentul de accept plată.</p>
          )}
          {canWrite ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  void patch(
                    { damagePaymentAcceptanceNotes: paymentAcceptanceNotes.trim() || null },
                    "Notă accept plată salvată.",
                  )
                }
                className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
              >
                Salvează notă
              </button>
              <label className="cursor-pointer rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800">
                {uploading
                  ? "Se încarcă…"
                  : paymentAcceptancePdfUrl
                    ? "Înlocuiește PDF"
                    : "Încarcă PDF accept plată"}
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  disabled={disabled || uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void (async () => {
                      setUploading(true);
                      setError(null);
                      try {
                        const up = await uploadDocumentFile(file, "Accept plată asigurător");
                        const next = await patch(
                          {
                            damagePaymentAcceptancePdfUrl: up.url,
                            damagePaymentAcceptanceFileName: up.name,
                            damagePaymentAcceptanceNotes: paymentAcceptanceNotes.trim() || null,
                          },
                          "Accept plată înregistrat pe dosar.",
                        );
                        if (next) {
                          setPaymentAcceptancePdfUrl(
                            next.damagePaymentAcceptancePdfUrl ?? up.url,
                          );
                          setPaymentAcceptanceFileName(
                            next.damagePaymentAcceptanceFileName ?? up.name,
                          );
                          setPipeline(next.damageInsurerPipelineStatus ?? "payment_accepted");
                        }
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Upload eșuat.");
                      } finally {
                        setUploading(false);
                        e.target.value = "";
                      }
                    })();
                  }}
                />
              </label>
              {paymentAcceptancePdfUrl ? (
                <button
                  type="button"
                  disabled={pending}
                  className="text-[11px] text-rose-400 hover:underline disabled:opacity-50"
                  onClick={() =>
                    void (async () => {
                      const next = await patch(
                        {
                          damagePaymentAcceptancePdfUrl: null,
                          damagePaymentAcceptanceFileName: null,
                        },
                        "PDF accept plată șters.",
                      );
                      if (next) {
                        setPaymentAcceptancePdfUrl(null);
                        setPaymentAcceptanceFileName(null);
                      }
                    })()
                  }
                >
                  Șterge PDF
                </button>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Foto auto reparat — după accept plată / reparație */}
      {!isClientPayer ? (
        <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/30 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Foto auto reparat ({repairedPhotos.length})
          </h4>
          <p className="text-[11px] text-zinc-500">
            Ultimul pas — multe societăți cer poze cu vehiculul reparat (după Accept plată / reparație).
          </p>
          {repairedPhotos.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {repairedPhotos.map((p) => (
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
                    {p.caption ?? "Auto reparat"}
                  </a>
                  {canWrite ? (
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
            <p className="text-xs text-zinc-500">Nicio poză cu auto reparat încă.</p>
          )}
          {canWrite ? (
            <input
              ref={repairedFileRef}
              type="file"
              accept="image/*,.pdf"
              disabled={disabled || uploading}
              className="text-xs text-zinc-400"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                if (!file) return;
                void (async () => {
                  setUploading(true);
                  setError(null);
                  try {
                    const up = await uploadDocumentFile(file, "Auto reparat");
                    const nextPhotos: DamagePhotoItem[] = [
                      ...photos,
                      {
                        id: `photo_${Date.now()}`,
                        url: up.url,
                        kind: repairedPhotoKind,
                        caption: up.name,
                        uploadedAt: new Date().toISOString(),
                      },
                    ];
                    const saved = await patch({ damagePhotos: nextPhotos }, "Poză auto reparat adăugată.");
                    if (saved) setPhotos(saved.damagePhotos ?? nextPhotos);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Upload eșuat.");
                  } finally {
                    setUploading(false);
                    if (repairedFileRef.current) repairedFileRef.current.value = "";
                  }
                })();
              }}
            />
          ) : null}
        </section>
      ) : null}

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
            </div>
          ) : null}
          <p className="text-[11px] text-zinc-500">
            Accept plată se înregistrează prin PDF-ul din rubrica de mai sus (nu din pipeline).
          </p>
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
  id: string;
  serviceCaseId: string;
  clientId: string;
  vehicleId: string;
  serviceCaseStage: string;
  serviceCaseStatus: string;
  serviceCaseTitle?: string;
  title: string;
  status?: string;
  displayNumber?: string | null;
  plannedAt?: string | null;
  completedAt?: string | null;
  inServiceAt?: string | null;
  outServiceAt?: string | null;
  odometerKmIn?: number | null;
  odometerKmOut?: number | null;
  repairPathNote?: string | null;
  serviceOrderType?: string;
  readyAt?: string | null;
  estimatedRepairAt?: string | null;
  quoteSummary?: {
    status: string | null;
    version: number | null;
    totalGrossCents: number | null;
    currency: string | null;
  };
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
  damageInsurerId?: string | null;
  damageClaimStatus?: string | null;
  damageInsurerAgreedAt?: string | null;
  damageDocuments?: DamageDocumentItem[];
  damagePhotos?: DamagePhotoItem[];
  damageSectionLocks?: DamageSectionLocks;
  damageCascoFranchiseCents?: number | null;
  damageInsurerEmail?: string | null;
  damageQuoteOrigin?: DamageQuoteOrigin | null;
  damageInsurerQuotePdfUrl?: string | null;
  damageInsurerMailLog?: DamageInsurerMailLogItem[];
  damageInspectionMode?: DamageInspectionMode | null;
  damageInspectionNotePdfUrl?: string | null;
  damageInspectionNoteFileName?: string | null;
  damageInspectionNoteIssuedOn?: string | null;
  damageInspectionNoteReceivedAt?: string | null;
  damageInspectionNoteNotes?: string | null;
  damageInspectionNotes?: DamageConstatareHistoryItem[];
  damagePaymentAcceptancePdfUrl?: string | null;
  damagePaymentAcceptanceFileName?: string | null;
  damagePaymentAcceptanceReceivedAt?: string | null;
  damagePaymentAcceptanceNotes?: string | null;
}): ServiceCaseRecord {
  const quoteFromSummary =
    wo.quoteSummary?.status && wo.quoteSummary.version != null
      ? {
          id: `wo_quote_${wo.id}`,
          workOrderId: wo.id,
          version: wo.quoteSummary.version,
          status: wo.quoteSummary.status as
            | "draft"
            | "submitted"
            | "approved"
            | "rejected",
          totalGrossCents: wo.quoteSummary.totalGrossCents ?? 0,
          currency: wo.quoteSummary.currency ?? "RON",
          invoicedAt: null,
          invoiceNumber: null,
          invoiceDate: null,
          invoiceAttachmentUrl: null,
          costEntryId: null,
        }
      : null;

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
    damageInsurerId: wo.damageInsurerId ?? null,
    damageClaimStatus: (wo.damageClaimStatus as DamageClaimStatus | null) ?? null,
    damageInsurerAgreedAt: wo.damageInsurerAgreedAt ?? null,
    damagePayerType: wo.damagePayerType ?? null,
    damageInsurerPipelineStatus: wo.damageInsurerPipelineStatus ?? null,
    damageDocuments: wo.damageDocuments ?? [],
    damagePhotos: wo.damagePhotos ?? [],
    damageSectionLocks: wo.damageSectionLocks ?? {},
    damageCascoFranchiseCents: wo.damageCascoFranchiseCents ?? null,
    damageInsurerEmail: wo.damageInsurerEmail ?? null,
    damageQuoteOrigin: wo.damageQuoteOrigin ?? null,
    damageInsurerQuotePdfUrl: wo.damageInsurerQuotePdfUrl ?? null,
    damageInsurerMailLog: wo.damageInsurerMailLog ?? [],
    damageInspectionMode: wo.damageInspectionMode ?? null,
    damageInspectionNotePdfUrl: wo.damageInspectionNotePdfUrl ?? null,
    damageInspectionNoteFileName: wo.damageInspectionNoteFileName ?? null,
    damageInspectionNoteIssuedOn: wo.damageInspectionNoteIssuedOn ?? null,
    damageInspectionNoteReceivedAt: wo.damageInspectionNoteReceivedAt ?? null,
    damageInspectionNoteNotes: wo.damageInspectionNoteNotes ?? null,
    damageInspectionNotes: wo.damageInspectionNotes ?? [],
    damagePaymentAcceptancePdfUrl: wo.damagePaymentAcceptancePdfUrl ?? null,
    damagePaymentAcceptanceFileName: wo.damagePaymentAcceptanceFileName ?? null,
    damagePaymentAcceptanceReceivedAt: wo.damagePaymentAcceptanceReceivedAt ?? null,
    damagePaymentAcceptanceNotes: wo.damagePaymentAcceptanceNotes ?? null,
    createdAt: wo.createdAt,
    updatedAt: wo.updatedAt,
    // Include the current WO so Dosar (opened from WO sheet) can link Comandă / quote.
    workOrders: [
      {
        id: wo.id,
        serviceCaseId: wo.serviceCaseId,
        vehicleId: wo.vehicleId,
        supplierId: wo.supplierId,
        supplierLegalName: wo.supplierLegalName,
        title: wo.title,
        status: wo.status ?? "draft",
        displayNumber: wo.displayNumber ?? null,
        odometerKmIn: wo.odometerKmIn ?? null,
        odometerKmOut: wo.odometerKmOut ?? null,
        repairPathNote: wo.repairPathNote ?? null,
        serviceOrderType: wo.serviceOrderType,
        readyAt: wo.readyAt ?? null,
        estimatedRepairAt: wo.estimatedRepairAt ?? null,
        plannedAt: wo.plannedAt ?? null,
        completedAt: wo.completedAt ?? null,
        inServiceAt: wo.inServiceAt ?? null,
        outServiceAt: wo.outServiceAt ?? null,
        createdAt: wo.createdAt,
        latestQuote: quoteFromSummary,
        approvedQuote:
          quoteFromSummary?.status === "approved" ? quoteFromSummary : null,
        pendingQuote:
          quoteFromSummary?.status === "submitted" ? quoteFromSummary : null,
      },
    ],
    appointments: [],
  };
}
