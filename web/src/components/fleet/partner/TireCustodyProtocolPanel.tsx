"use client";

import { useEffect, useRef, useState } from "react";
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
  type TireCustodyProtocolRecord,
  type TireCustodySignerRole,
} from "@/lib/tire-custody-api";

const CHECKLIST_LABELS: Record<string, string> = {
  set_complete: "Set complet (toate anvelopele)",
  tread_noted: "Profil / uzură notate",
  photos_taken: "Poze intake atașate",
  bay_assigned: "Bay / bin alocat",
  counterparty_id_checked: "Identitate contrapartidă verificată",
};

type Props = {
  protocol: TireCustodyProtocolRecord;
  canWrite: boolean;
  supplierId?: string | null;
  onUpdated: (p: TireCustodyProtocolRecord) => void;
  onClose?: () => void;
};

export function TireCustodyProtocolPanel({
  protocol,
  canWrite,
  supplierId,
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

  useEffect(() => {
    setSignerName("");
    const hasPartner = protocol.signatures.some((s) => s.role === "partner");
    setSignerRole(hasPartner ? "customer" : "partner");
    padRef.current?.clear();
  }, [protocol.id, protocol.signatures]);

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

  const rolesPresent = new Set(protocol.signatures.map((s) => s.role));
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
            {tireCustodyKindLabel(protocol.kind)} · rev {protocol.revision}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {protocol.plate ?? "—"} · status{" "}
            <span className="text-zinc-300">{protocol.status}</span>
          </p>
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
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-zinc-500">
              Locație / bay
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
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-zinc-500">
              Stare / uzură
            </span>
            <textarea
              defaultValue={protocol.conditionNotes ?? ""}
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
              Contrapartidă (nume)
            </span>
            <input
              defaultValue={protocol.counterpartyName ?? ""}
              onBlur={(e) => {
                const v = e.target.value.trim() || null;
                if (v !== (protocol.counterpartyName ?? null)) {
                  void saveFields({ counterpartyName: v });
                }
              }}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
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

          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Checklist</p>
            {Object.entries(CHECKLIST_LABELS).map(([key, label]) => (
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
                  OTP: <span className="font-mono text-base tracking-widest">{driverInvite.otp}</span>
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
                {driverInvite.smsSent ? (
                  <p className="text-emerald-300">SMS OTP trimis.</p>
                ) : null}
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

          {protocol.kind === "scrap" ||
          protocol.kind === "transfer" ||
          protocol.kind === "leasing_return" ? (
            <p className="text-xs text-amber-200/90">
              La finalizare se închide sejurul hotel și se mută stocul (
              {protocol.kind === "scrap"
                ? "casare"
                : protocol.kind === "transfer"
                  ? "in transit"
                  : "la client / leasing"}
              ). Necesită PV check-in arhivat.
            </p>
          ) : null}
          <button
            type="button"
            disabled={pending || !canFinalize}
            onClick={() => void finalize()}
            className="w-full rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Finalizează PV (acceptare bilaterală)
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
                Rectificare: anulează PV-ul curent și deschide o revizie nouă (istoric păstrat).
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
                Anulează și creează revizie nouă
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {protocol.status === "voided" ? (
        <p className="text-xs text-zinc-500">
          Anulat{protocol.voidReason ? `: ${protocol.voidReason}` : ""}. Deschide din nou PV pentru
          o revizie nouă.
        </p>
      ) : null}
    </div>
  );
}
