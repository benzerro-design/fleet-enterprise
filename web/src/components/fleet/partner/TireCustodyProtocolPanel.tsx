"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  RsaSignaturePad,
  type RsaSignaturePadHandle,
} from "@/components/fleet/rsa/RsaSignaturePad";
import { uploadDocumentFile } from "@/lib/document-upload";
import {
  addTireCustodyMedia,
  addTireCustodySignature,
  createTireCustodyDriverInvite,
  finalizeTireCustodyProtocol,
  openTireCustodyProtocol,
  patchTireCustodyProtocol,
  tireCustodyKindLabel,
  tireCustodyProtocolPdfUrl,
  tireCustodyRoleLabel,
  voidTireCustodyProtocol,
  type TireCustodyProtocolKind,
  type TireCustodyProtocolRecord,
  type TireCustodySignerRole,
} from "@/lib/tire-custody-api";

const CHECKLIST_BY_KIND: Record<TireCustodyProtocolKind, Record<string, string>> = {
  check_in: {
    set_complete: "Set complet (toate anvelopele)",
    tread_noted: "Profil / uzură notate la primire",
    photos_taken: "Poze la intrare atașate",
    bay_assigned: "Locație / raft alocat",
    counterparty_id_checked: "Identitate predător verificată",
  },
  check_out: {
    set_complete: "Set complet la predare",
    condition_at_exit_noted: "Stare / profil la ieșire notate",
    photos_taken: "Poze la predare atașate",
    recipient_id_checked: "Identitate primitor verificată",
  },
  seasonal: {
    set_complete: "Seturi implicate verificate",
    photos_taken: "Poze atașate",
    seasonal_swap_noted: "Schimb sezon documentat",
  },
  transfer: {
    set_complete: "Set complet",
    photos_taken: "Poze predare atașate",
    recipient_partner_confirmed: "Partener destinatar confirmat",
  },
  scrap: {
    set_complete: "Set identificat pentru casare",
    photos_taken: "Poze casare atașate",
    scrap_reason_noted: "Motiv casare notat",
  },
  leasing_return: {
    set_complete: "Set complet",
    photos_taken: "Poze predare atașate",
    leasing_party_confirmed: "Firmă leasing / primitor confirmat",
  },
  quarantine: {
    photos_taken: "Poze stare atașate",
    quarantine_reason_noted: "Motiv carantină notat",
    set_isolated: "Set izolat pe raft",
  },
};

function conditionLabel(kind: TireCustodyProtocolKind): string {
  if (kind === "check_in") return "Stare / uzură la primire";
  if (kind === "check_out" || kind === "leasing_return") return "Stare / uzură la predare";
  if (kind === "scrap") return "Motiv casare / stare";
  if (kind === "quarantine") return "Motiv carantină (obligatoriu)";
  if (kind === "transfer") return "Observații predare";
  if (kind === "seasonal") return "Observații schimb sezon";
  return "Stare / observații";
}

function partyLabel(kind: TireCustodyProtocolKind): string {
  if (kind === "check_in") return "Predat de (client / șofer)";
  if (kind === "check_out" || kind === "leasing_return") return "Primit de (client / șofer)";
  if (kind === "transfer") return "Contact la destinatar (opțional)";
  if (kind === "scrap") return "Confirmare casare (nume)";
  if (kind === "quarantine") return "Responsabil";
  return "Parte";
}

function finalizeHint(kind: TireCustodyProtocolKind): string | null {
  if (kind === "check_out") {
    return "La finalizare setul iese din inventar → la client.";
  }
  if (kind === "scrap") {
    return "La finalizare setul iese din inventar (casare) și se arhivează.";
  }
  if (kind === "leasing_return") {
    return "La finalizare setul iese din inventar → returnare leasing / client.";
  }
  if (kind === "transfer") {
    return "La finalizare sejurul trece la partenerul destinatar (rămâne în hotel).";
  }
  if (kind === "quarantine") {
    return "La finalizare setul rămâne în inventar, dar e blocat (nu poate fi predat).";
  }
  if (kind === "seasonal") {
    return "Document informativ — nu mută stocul. Schimbul complet (predare + recepție) vine separat.";
  }
  return null;
}

type Props = {
  protocol: TireCustodyProtocolRecord;
  canWrite: boolean;
  supplierId?: string | null;
  transferTargets?: Array<{ id: string; legalName: string }>;
  onUpdated: (p: TireCustodyProtocolRecord) => void;
  onClose?: () => void;
};

export function TireCustodyProtocolPanel({
  protocol,
  canWrite,
  supplierId,
  transferTargets = [],
  onUpdated,
  onClose,
}: Props) {
  const padRef = useRef<RsaSignaturePadHandle>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signerName, setSignerName] = useState("");
  const [signerRole, setSignerRole] = useState<TireCustodySignerRole>("partner");
  const [voidReason, setVoidReason] = useState("");
  const [driverEmail, setDriverEmail] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [driverInvite, setDriverInvite] = useState<{
    url: string;
    otp: string;
    expiresAt: string;
    emailSent?: boolean;
    emailError?: string | null;
    smsSent?: boolean;
    smsError?: string | null;
  } | null>(null);
  const draft = protocol.status === "draft";
  const media = protocol.media ?? [];
  const kind = protocol.kind;
  const checklistLabels = CHECKLIST_BY_KIND[kind] ?? { photos_taken: "Poze atașate" };
  const isCheckIn = kind === "check_in";
  const stayLoc = protocol.stayLocationLabel || protocol.locationText;

  useEffect(() => {
    setSignerName("");
    const hasPartner = protocol.signatures.some((s) => s.role === "partner");
    setSignerRole(hasPartner ? "customer" : "partner");
    padRef.current?.clear();
  }, [protocol.id, protocol.signatures]);

  const rolesPresent = useMemo(
    () => new Set(protocol.signatures.map((s) => s.role)),
    [protocol.signatures],
  );

  async function saveFields(
    patch: Parameters<typeof patchTireCustodyProtocol>[1],
  ) {
    setPending(true);
    setError(null);
    try {
      const next = await patchTireCustodyProtocol(protocol.id, patch);
      onUpdated(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvare eșuată");
    } finally {
      setPending(false);
    }
  }

  async function addSignature() {
    if (!signerName.trim()) {
      setError("Numele semnatarului e obligatoriu");
      return;
    }
    const exported = await padRef.current?.exportPngAndStrokes();
    if (!exported) {
      setError("Desenează semnătura pe pad");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const file = new File([exported.blob], `tire-sig-${signerRole}.png`, {
        type: "image/png",
      });
      const uploaded = await uploadDocumentFile(file, `Semnătură ${signerRole}`);
      const next = await addTireCustodySignature(protocol.id, {
        role: signerRole,
        displayName: signerName.trim(),
        signaturePngUrl: uploaded.url,
        strokePathJson: exported.strokes,
        deviceMetaJson: {
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          at: new Date().toISOString(),
        },
      });
      onUpdated(next);
      padRef.current?.clear();
      setSignerName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Semnare eșuată");
    } finally {
      setPending(false);
    }
  }

  async function onPhotoSelected(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setPending(true);
    setError(null);
    try {
      const uploaded = await uploadDocumentFile(file, "PV anvelope media");
      const next = await addTireCustodyMedia(protocol.id, {
        kind: "condition",
        fileUrl: uploaded.url,
        fileName: uploaded.name,
      });
      onUpdated(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload eșuat");
    } finally {
      setPending(false);
    }
  }

  async function finalize() {
    setPending(true);
    setError(null);
    try {
      const next = await finalizeTireCustodyProtocol(protocol.id);
      onUpdated(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Finalizare eșuată");
    } finally {
      setPending(false);
    }
  }

  async function inviteDriver() {
    setPending(true);
    setError(null);
    try {
      const res = await createTireCustodyDriverInvite(protocol.id, {
        email: driverEmail.trim() || null,
        phone: driverPhone.trim() || null,
      });
      setDriverInvite({
        url: res.url,
        otp: res.otp,
        expiresAt: res.expiresAt,
        emailSent: res.emailSent,
        emailError: res.emailError,
        smsSent: res.smsSent,
        smsError: res.smsError,
      });
      onUpdated(res.protocol);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invite eșuat");
    } finally {
      setPending(false);
    }
  }

  async function voidAndRectify() {
    if (!voidReason.trim()) {
      setError("Motivul anulării e obligatoriu");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await voidTireCustodyProtocol(protocol.id, voidReason.trim());
      const next = await openTireCustodyProtocol(
        protocol.stayId,
        protocol.kind,
        supplierId,
        protocol.workOrderId ? { workOrderId: protocol.workOrderId } : undefined,
      );
      onUpdated(next);
      setVoidReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Anulare eșuată");
    } finally {
      setPending(false);
    }
  }

  const canFinalize =
    draft &&
    rolesPresent.has("partner") &&
    (rolesPresent.has("customer") || rolesPresent.has("driver")) &&
    media.length > 0;

  return (
    <div className="space-y-3 rounded-2xl border border-emerald-900/40 bg-emerald-950/20 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-emerald-100">
            {tireCustodyKindLabel(protocol.kind)} · versiunea {protocol.revision}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {protocol.plate ?? "—"} · status{" "}
            <span className="text-zinc-300">{protocol.status}</span>
          </p>
          {finalizeHint(kind) ? (
            <p className="mt-1 text-[11px] text-amber-200/85">{finalizeHint(kind)}</p>
          ) : null}
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            Închide
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-200">
          {error}
        </p>
      ) : null}

      {draft && canWrite ? (
        <>
          {isCheckIn ? (
            <label className="block space-y-1">
              <span className="text-[11px] uppercase tracking-wide text-zinc-500">
                Locație / raft alocat
              </span>
              <input
                defaultValue={protocol.locationText ?? ""}
                onBlur={(e) => {
                  const v = e.target.value.trim() || null;
                  if (v !== (protocol.locationText ?? null)) {
                    void saveFields({ locationText: v });
                  }
                }}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              />
            </label>
          ) : stayLoc ? (
            <p className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs text-zinc-400">
              Ridicat din / pe raft:{" "}
              <span className="font-medium text-zinc-200">{stayLoc}</span>
            </p>
          ) : null}

          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-zinc-500">
              {conditionLabel(kind)}
            </span>
            <textarea
              defaultValue={protocol.conditionNotes ?? ""}
              key={`cond-${protocol.id}-${protocol.revision}`}
              rows={2}
              onBlur={(e) => {
                const v = e.target.value.trim() || null;
                if (v !== (protocol.conditionNotes ?? null)) {
                  void saveFields({ conditionNotes: v });
                }
              }}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-zinc-500">
              {partyLabel(kind)}
            </span>
            <input
              defaultValue={protocol.counterpartyName ?? ""}
              key={`party-${protocol.id}`}
              onBlur={(e) => {
                const v = e.target.value.trim() || null;
                if (v !== (protocol.counterpartyName ?? null)) {
                  void saveFields({ counterpartyName: v });
                }
              }}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
          </label>

          {kind === "transfer" ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block space-y-1 sm:col-span-2">
                <span className="text-[11px] uppercase tracking-wide text-zinc-500">
                  Partener destinatar
                </span>
                <select
                  value={protocol.targetSupplierId ?? ""}
                  disabled={pending}
                  onChange={(e) => {
                    void saveFields({ targetSupplierId: e.target.value || null });
                  }}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                >
                  <option value="">— alege partener —</option>
                  {transferTargets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.legalName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 sm:col-span-2">
                <span className="text-[11px] uppercase tracking-wide text-zinc-500">
                  Locație la destinatar (opțional)
                </span>
                <input
                  defaultValue={protocol.targetLocationCode ?? ""}
                  key={`tloc-${protocol.id}`}
                  onBlur={(e) => {
                    const v = e.target.value.trim() || null;
                    if (v !== (protocol.targetLocationCode ?? null)) {
                      void saveFields({ targetLocationCode: v });
                    }
                  }}
                  placeholder="ex. A1 / bay-bin"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                />
              </label>
            </div>
          ) : null}

          {kind === "scrap" ? (
            <label className="block space-y-1">
              <span className="text-[11px] uppercase tracking-wide text-zinc-500">
                Notă contabilitate (opțional)
              </span>
              <input
                defaultValue={protocol.accountingNote ?? ""}
                key={`acc-${protocol.id}`}
                onBlur={(e) => {
                  const v = e.target.value.trim() || null;
                  if (v !== (protocol.accountingNote ?? null)) {
                    void saveFields({ accountingNote: v });
                  }
                }}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              />
            </label>
          ) : null}

          {isCheckIn || kind === "seasonal" ? (
            <label className="block space-y-1">
              <span className="text-[11px] uppercase tracking-wide text-zinc-500">
                Work order ID (opțional)
              </span>
              <input
                defaultValue={protocol.workOrderId ?? ""}
                onBlur={(e) => {
                  const v = e.target.value.trim() || null;
                  if (v !== (protocol.workOrderId ?? null)) {
                    void saveFields({ workOrderId: v });
                  }
                }}
                placeholder="cuid WO tip R / sezonier"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-100"
              />
            </label>
          ) : null}

          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Checklist</p>
            {Object.entries(checklistLabels).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={Boolean(protocol.checklist?.[key])}
                  disabled={pending}
                  onChange={(e) => {
                    void saveFields({
                      checklist: { ...protocol.checklist, [key]: e.target.checked },
                    });
                  }}
                />
                {label}
              </label>
            ))}
          </div>

          <div className="space-y-2 border-t border-zinc-800 pt-3">
            <p className="text-xs font-medium text-zinc-200">
              Poze PV ({media.length}) — minim 1 înainte de finalizare
            </p>
            {media.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {media.map((m) => (
                  <li key={m.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.fileUrl}
                      alt={m.caption ?? m.kind}
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  </li>
                ))}
              </ul>
            ) : null}
            <label className="inline-flex cursor-pointer rounded-xl border border-zinc-600 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800">
              Adaugă poză
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={pending}
                onChange={(e) => {
                  void onPhotoSelected(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          <div className="space-y-2 border-t border-zinc-800 pt-3">
            <p className="text-xs font-medium text-zinc-200">Link OTP șofer</p>
            <input
              value={driverEmail}
              onChange={(e) => setDriverEmail(e.target.value)}
              placeholder="Email șofer (opțional — trimite OTP)"
              type="email"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
            <input
              value={driverPhone}
              onChange={(e) => setDriverPhone(e.target.value)}
              placeholder="Telefon șofer (opțional — SMS OTP)"
              type="tel"
              inputMode="tel"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
            <button
              type="button"
              disabled={pending || rolesPresent.has("driver")}
              onClick={() => void inviteDriver()}
              className="w-full rounded-xl border border-sky-700/50 px-3 py-2.5 text-sm font-medium text-sky-100 disabled:opacity-50"
            >
              Generează link + OTP șofer
            </button>
            {driverInvite ? (
              <div className="space-y-1 rounded-lg border border-sky-900/40 bg-sky-950/30 p-2 text-xs text-sky-100">
                <p className="break-all font-mono">{driverInvite.url}</p>
                <p>
                  OTP:{" "}
                  <span className="font-mono text-base tracking-widest">{driverInvite.otp}</span>
                </p>
                <p className="text-sky-300/80">
                  Expiră {new Date(driverInvite.expiresAt).toLocaleString("ro-RO")}
                </p>
                {driverInvite.emailSent ? (
                  <p className="text-emerald-300">Email OTP trimis.</p>
                ) : null}
                {driverInvite.emailError ? (
                  <p className="text-amber-200">Email: {driverInvite.emailError}</p>
                ) : null}
                {driverInvite.smsSent ? <p className="text-emerald-300">SMS OTP trimis.</p> : null}
                {driverInvite.smsError ? (
                  <p className="text-amber-200">SMS: {driverInvite.smsError}</p>
                ) : null}
              </div>
            ) : protocol.hasDriverInvite ? (
              <p className="text-xs text-sky-300/80">Există un invite activ pentru șofer.</p>
            ) : null}
          </div>

          <div className="space-y-2 border-t border-zinc-800 pt-3">
            <p className="text-xs font-medium text-zinc-200">
              Semnătură (necesar: partener + client/șofer)
            </p>
            <div className="flex gap-2">
              <select
                value={signerRole}
                onChange={(e) => setSignerRole(e.target.value as TireCustodySignerRole)}
                className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              >
                {(["partner", "customer", "driver", "witness"] as TireCustodySignerRole[]).map(
                  (r) => (
                    <option key={r} value={r} disabled={rolesPresent.has(r)}>
                      {tireCustodyRoleLabel(r)}
                      {rolesPresent.has(r) ? " ✓" : ""}
                    </option>
                  ),
                )}
              </select>
              <input
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Nume semnatar"
                className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              />
            </div>
            <RsaSignaturePad ref={padRef} disabled={pending} />
            <button
              type="button"
              disabled={pending}
              onClick={() => void addSignature()}
              className="w-full rounded-xl bg-zinc-100 px-3 py-2.5 text-sm font-medium text-zinc-900 disabled:opacity-50"
            >
              Adaugă semnătură
            </button>
          </div>

          <button
            type="button"
            disabled={pending || !canFinalize}
            onClick={() => void finalize()}
            className="w-full rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Finalizează PV
            {kind === "check_out"
              ? " (eliberează la client)"
              : kind === "scrap"
                ? " (casare)"
                : kind === "transfer"
                  ? " (mută la partener)"
                  : kind === "quarantine"
                    ? " (blochează pe raft)"
                    : " (acceptare bilaterală)"}
          </button>
        </>
      ) : null}

      {protocol.signatures.length > 0 ? (
        <ul className="space-y-1 text-xs text-zinc-400">
          {protocol.signatures.map((s) => (
            <li key={s.id}>
              {tireCustodyRoleLabel(s.role)}: {s.displayName}
            </li>
          ))}
        </ul>
      ) : null}

      {protocol.status === "signed" ? (
        <div className="space-y-2">
          <a
            href={tireCustodyProtocolPdfUrl(protocol.id)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-full items-center justify-center rounded-xl border border-emerald-700/60 bg-emerald-950/40 px-3 py-2.5 text-sm font-medium text-emerald-100"
          >
            Descarcă PDF {protocol.hasArchivedPdf ? "arhivat" : "semnat"}
          </a>
          {protocol.pdfSha256 ? (
            <p className="break-all font-mono text-[10px] text-zinc-500">
              SHA-256 {protocol.pdfSha256}
            </p>
          ) : null}
          {canWrite ? (
            <div className="space-y-2 border-t border-zinc-800 pt-3">
              <p className="text-xs text-zinc-400">
                Rectificare: anulează PV-ul curent și creează un PV nou (versiune următoare — istoric
                păstrat).
                {kind === "quarantine"
                  ? " Anularea unui PV carantină semnat deblochează setul pe raft."
                  : ""}
              </p>
              <input
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Motiv anulare / rectificare"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              />
              <button
                type="button"
                disabled={pending}
                onClick={() => void voidAndRectify()}
                className="w-full rounded-xl border border-amber-700/50 px-3 py-2.5 text-sm font-medium text-amber-100 disabled:opacity-50"
              >
                Anulează și creează PV nou
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {protocol.status === "voided" ? (
        <p className="text-xs text-zinc-500">
          Anulat{protocol.voidReason ? `: ${protocol.voidReason}` : ""}. Deschide din nou un PV
          pentru o versiune nouă.
        </p>
      ) : null}
    </div>
  );
}
