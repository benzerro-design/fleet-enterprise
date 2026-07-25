"use client";

import { useEffect, useMemo, useState } from "react";
import { OPS_INPUT_CLASS, OPS_LABEL_CLASS } from "@/components/fleet/ops-form-primitives";
import {
  DAMAGE_DOCUMENT_KINDS,
  damageClaimStatusLabel,
  fleetJsonHeaders,
  serviceCasesBrowserBase,
  type DamageClaimStatus,
  type DamageDocumentItem,
  type DamageInsuranceType,
  type ServiceCaseRecord,
} from "@/lib/service-cases-api";

type Props = {
  serviceCase: ServiceCaseRecord | null | undefined;
  canWrite: boolean;
  onUpdated?: (next: ServiceCaseRecord) => void;
};

const INSURANCE_OPTIONS: { value: DamageInsuranceType; label: string }[] = [
  { value: "RCA", label: "RCA" },
  { value: "CASCO", label: "CASCO" },
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

function emptyDocs(): DamageDocumentItem[] {
  return DAMAGE_DOCUMENT_KINDS.map((d) => ({
    id: d.kind,
    kind: d.kind,
    label: d.label,
    received: false,
    uploadedAt: new Date().toISOString(),
  }));
}

function mergeDocs(existing: DamageDocumentItem[] | undefined): DamageDocumentItem[] {
  const byKind = new Map((existing ?? []).map((d) => [d.kind, d]));
  return DAMAGE_DOCUMENT_KINDS.map((d) => {
    const prev = byKind.get(d.kind);
    if (prev) return { ...prev, label: prev.label ?? d.label };
    return {
      id: d.kind,
      kind: d.kind,
      label: d.label,
      received: false,
      uploadedAt: new Date().toISOString(),
    };
  });
}

export function DamageClaimPanel({ serviceCase, canWrite, onUpdated }: Props) {
  const isDamage = serviceCase?.workflowType === "damage";
  const [insuranceType, setInsuranceType] = useState<DamageInsuranceType | "">("");
  const [claimNumber, setClaimNumber] = useState("");
  const [insurerName, setInsurerName] = useState("");
  const [claimStatus, setClaimStatus] = useState<DamageClaimStatus>("open");
  const [agreementNotes, setAgreementNotes] = useState("");
  const [docs, setDocs] = useState<DamageDocumentItem[]>(emptyDocs());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    if (!serviceCase || serviceCase.workflowType !== "damage") return;
    setInsuranceType(serviceCase.damageInsuranceType ?? "");
    setClaimNumber(serviceCase.damageClaimNumber ?? "");
    setInsurerName(serviceCase.damageInsurerName ?? "");
    setClaimStatus(serviceCase.damageClaimStatus ?? "open");
    setAgreementNotes(serviceCase.damageInsurerAgreementNotes ?? "");
    setDocs(mergeDocs(serviceCase.damageDocuments));
  }, [serviceCase]);

  const agreedAt = serviceCase?.damageInsurerAgreedAt ?? null;
  const docsReceived = useMemo(() => docs.filter((d) => d.received).length, [docs]);

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

  async function save(extra?: { agreeInsurer?: boolean }) {
    setPending(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`${serviceCasesBrowserBase}/${serviceCase!.id}/damage-claim`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          damageInsuranceType: insuranceType || null,
          damageClaimNumber: claimNumber.trim() || null,
          damageInsurerName: insurerName.trim() || null,
          damageClaimStatus: claimStatus,
          damageDocuments: docs,
          damageInsurerAgreementNotes: agreementNotes.trim() || null,
          ...extra,
        }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string };
          if (j.message) msg = Array.isArray(j.message) ? j.message.join(", ") : j.message;
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      const next = (await res.json()) as ServiceCaseRecord;
      onUpdated?.(next);
      setOk(extra?.agreeInsurer ? "Acord asigurător înregistrat." : "Dosar daună salvat.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-zinc-100">Dosar daună</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Documentele evenimentului (declarație, poliție, amiabilă, CI, permis) trebuie să vină de la
          persoana implicată. Execuția reparației cere acordul asigurătorului și mașină la schimb.
        </p>
      </div>

      {agreedAt ? (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-100">
          Acord asigurător înregistrat ·{" "}
          {new Date(agreedAt).toLocaleString("ro-RO", { dateStyle: "medium", timeStyle: "short" })}
        </div>
      ) : (
        <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 px-3 py-2 text-sm text-amber-100">
          Fără acord asigurător nu se poate marca intrarea în service (reparație).
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={OPS_LABEL_CLASS}>Tip asigurare</span>
          <select
            className={OPS_INPUT_CLASS}
            disabled={!canWrite || pending}
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
            disabled={!canWrite || pending}
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
            disabled={!canWrite || pending}
            value={claimNumber}
            onChange={(e) => setClaimNumber(e.target.value)}
            placeholder="ex. DAUNA-2026-…"
          />
        </label>
        <label className="block">
          <span className={OPS_LABEL_CLASS}>Asigurător</span>
          <input
            className={OPS_INPUT_CLASS}
            disabled={!canWrite || pending}
            value={insurerName}
            onChange={(e) => setInsurerName(e.target.value)}
            placeholder="Nume societate"
          />
        </label>
      </div>

      <div>
        <p className={OPS_LABEL_CLASS}>
          Documente eveniment ({docsReceived}/{docs.length} primite)
        </p>
        <ul className="mt-1 space-y-2">
          {docs.map((doc) => (
            <li
              key={doc.kind}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2"
            >
              <label className="flex min-w-[10rem] flex-1 items-center gap-2 text-sm text-zinc-200">
                <input
                  type="checkbox"
                  disabled={!canWrite || pending}
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
                disabled={!canWrite || pending}
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
      </div>

      <label className="block">
        <span className={OPS_LABEL_CLASS}>Note acord / asigurare</span>
        <textarea
          className={OPS_INPUT_CLASS}
          rows={2}
          disabled={!canWrite || pending}
          value={agreementNotes}
          onChange={(e) => setAgreementNotes(e.target.value)}
        />
      </label>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      {ok ? <p className="text-sm text-emerald-400">{ok}</p> : null}

      {canWrite ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => void save()}
            className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
          >
            Salvează dosar
          </button>
          {!agreedAt ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => void save({ agreeInsurer: true })}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Înregistrează acord asigurător
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
