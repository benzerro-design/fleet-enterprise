"use client";

import { useEffect, useRef, useState } from "react";
import { OPS_INPUT_CLASS, OPS_LABEL_CLASS } from "@/components/fleet/ops-form-primitives";
import {
  RsaSignaturePad,
  type RsaSignaturePadHandle,
} from "@/components/fleet/rsa/RsaSignaturePad";
import { uploadDocumentFile } from "@/lib/document-upload";
import {
  blobToDataUrl,
  enqueueRsaOfflineOp,
} from "@/lib/rsa-offline-queue";
import {
  addRsaMedia,
  addRsaSignature,
  finalizeRsaProtocol,
  patchRsaProtocol,
  rsaHandoverKindLabel,
  rsaProtocolPdfUrl,
  type RsaHandoverKind,
  type RsaHandoverMediaKind,
  type RsaHandoverSignerRole,
  type RsaProtocolRecord,
} from "@/lib/roadside-api";

const CHECKLIST_LABELS: Record<string, string> = {
  papers_present: "Acte / talon prezente",
  keys_present: "Chei predate",
  spare_wheel: "Roată rezervă verificată",
  valuables_noted: "Obiecte de valoare notate",
  damage_photographed: "Daune fotografiate",
};

const MEDIA_KINDS: RsaHandoverMediaKind[] = [
  "front",
  "rear",
  "left",
  "right",
  "damage",
  "odometer",
  "other",
];

type Props = {
  protocol: RsaProtocolRecord;
  canWrite: boolean;
  onUpdated: (p: RsaProtocolRecord) => void;
  /** Notificare după enqueue offline (ex. refresh banner). */
  onQueuedOffline?: () => void;
};

function isOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

export function RsaHandoverPanel({
  protocol,
  canWrite,
  onUpdated,
  onQueuedOffline,
}: Props) {
  const padRef = useRef<RsaSignaturePadHandle>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [signerName, setSignerName] = useState("");
  const [signerRole, setSignerRole] = useState<RsaHandoverSignerRole>(
    protocol.kind === "pickup" ? "customer" : "receiver",
  );
  const draft = protocol.status === "draft";

  useEffect(() => {
    setSignerName("");
    setSignerRole(protocol.kind === "pickup" ? "customer" : "receiver");
    padRef.current?.clear();
  }, [protocol.id, protocol.kind]);

  async function saveFields(patch: Parameters<typeof patchRsaProtocol>[1]) {
    setPending(true);
    setError(null);
    setInfo(null);
    try {
      if (isOffline()) {
        await enqueueRsaOfflineOp({
          type: "patch_protocol",
          protocolId: protocol.id,
          payload: patch as Record<string, unknown>,
        });
        setInfo("Salvat offline — se sincronizează la reconectare");
        onQueuedOffline?.();
        return;
      }
      const next = await patchRsaProtocol(protocol.id, patch);
      onUpdated(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvare eșuată");
    } finally {
      setPending(false);
    }
  }

  async function onPhoto(kind: RsaHandoverMediaKind, file: File | null) {
    if (!file || !canWrite || !draft) return;
    setPending(true);
    setError(null);
    setInfo(null);
    try {
      if (isOffline()) {
        const dataUrl = await blobToDataUrl(file);
        await enqueueRsaOfflineOp({
          type: "add_media",
          protocolId: protocol.id,
          payload: { kind, dataUrl, fileName: file.name },
        });
        setInfo(`Foto ${kind} în coadă offline`);
        onQueuedOffline?.();
        return;
      }
      const up = await uploadDocumentFile(file, `rsa-${protocol.kind}-${kind}`);
      const next = await addRsaMedia(protocol.id, {
        kind,
        fileUrl: up.url,
        fileName: up.name,
      });
      onUpdated(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload eșuat");
    } finally {
      setPending(false);
    }
  }

  async function submitSignature(role: RsaHandoverSignerRole, name: string) {
    if (!canWrite || !draft) return;
    const exported = await padRef.current?.exportPngAndStrokes();
    if (!exported) {
      setError("Semnătura este goală");
      return;
    }
    if (!name.trim()) {
      setError("Numele semnatarului este obligatoriu");
      return;
    }
    setPending(true);
    setError(null);
    setInfo(null);
    try {
      const deviceMeta = {
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        screen:
          typeof window !== "undefined"
            ? { w: window.innerWidth, h: window.innerHeight }
            : null,
        offline: isOffline(),
      };
      if (isOffline()) {
        const pngDataUrl = await blobToDataUrl(exported.blob);
        await enqueueRsaOfflineOp({
          type: "add_signature",
          protocolId: protocol.id,
          payload: {
            role,
            displayName: name.trim(),
            pngDataUrl,
            strokePathJson: exported.strokes,
            deviceMetaJson: deviceMeta,
          },
        });
        setInfo("Semnătură în coadă offline");
        onQueuedOffline?.();
        padRef.current?.clear();
        setSignerName("");
        return;
      }
      const file = new File([exported.blob], `sig-${role}.png`, { type: "image/png" });
      const up = await uploadDocumentFile(file, `rsa-sig-${role}`);
      const next = await addRsaSignature(protocol.id, {
        role,
        displayName: name.trim(),
        signaturePngUrl: up.url,
        strokePathJson: exported.strokes,
        deviceMetaJson: deviceMeta,
      });
      onUpdated(next);
      padRef.current?.clear();
      setSignerName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Semnătură eșuată");
    } finally {
      setPending(false);
    }
  }

  async function onFinalize() {
    if (!canWrite || !draft) return;
    setPending(true);
    setError(null);
    setInfo(null);
    try {
      if (isOffline()) {
        await enqueueRsaOfflineOp({
          type: "finalize_protocol",
          protocolId: protocol.id,
          payload: {},
        });
        setInfo("Finalizare PV în coadă offline");
        onQueuedOffline?.();
        return;
      }
      const next = await finalizeRsaProtocol(protocol.id);
      onUpdated(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Finalizare eșuată");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-medium text-zinc-100">
            {rsaHandoverKindLabel(protocol.kind as RsaHandoverKind)}
          </h4>
          <p className="text-xs text-zinc-500">
            Status: {protocol.status}
            {protocol.signedAt ? ` · ${new Date(protocol.signedAt).toLocaleString("ro-RO")}` : ""}
          </p>
        </div>
        {protocol.status === "signed" ? (
          <a
            href={rsaProtocolPdfUrl(protocol.id)}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-emerald-700/50 px-3 py-1.5 text-xs text-emerald-200"
          >
            Descarcă PDF
          </a>
        ) : null}
      </div>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      {info ? <p className="text-sm text-amber-300">{info}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={OPS_LABEL_CLASS}>Locație</span>
          <input
            className={OPS_INPUT_CLASS}
            disabled={!canWrite || !draft || pending}
            defaultValue={protocol.locationText ?? ""}
            onBlur={(e) => {
              if (e.target.value !== (protocol.locationText ?? "")) {
                void saveFields({ locationText: e.target.value || null });
              }
            }}
          />
        </label>
        <label className="block">
          <span className={OPS_LABEL_CLASS}>Odometru (km)</span>
          <input
            className={OPS_INPUT_CLASS}
            inputMode="numeric"
            disabled={!canWrite || !draft || pending}
            defaultValue={protocol.odometerKm ?? ""}
            onBlur={(e) => {
              const n = e.target.value.trim() ? Number(e.target.value) : null;
              void saveFields({ odometerKm: Number.isFinite(n as number) ? n : null });
            }}
          />
        </label>
        <label className="block">
          <span className={OPS_LABEL_CLASS}>Combustibil (%)</span>
          <input
            className={OPS_INPUT_CLASS}
            inputMode="numeric"
            disabled={!canWrite || !draft || pending}
            defaultValue={protocol.fuelLevelPct ?? ""}
            onBlur={(e) => {
              const n = e.target.value.trim() ? Number(e.target.value) : null;
              void saveFields({ fuelLevelPct: Number.isFinite(n as number) ? n : null });
            }}
          />
        </label>
        <label className="block">
          <span className={OPS_LABEL_CLASS}>Contrapartidă (nume)</span>
          <input
            className={OPS_INPUT_CLASS}
            disabled={!canWrite || !draft || pending}
            defaultValue={protocol.counterpartyName ?? ""}
            onBlur={(e) => {
              if (e.target.value !== (protocol.counterpartyName ?? "")) {
                void saveFields({ counterpartyName: e.target.value || null });
              }
            }}
          />
        </label>
      </div>

      <div>
        <span className={OPS_LABEL_CLASS}>Checklist</span>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {Object.keys(CHECKLIST_LABELS).map((key) => (
            <label key={key} className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                disabled={!canWrite || !draft || pending}
                checked={Boolean(protocol.checklist?.[key])}
                onChange={(e) => {
                  void saveFields({
                    checklist: { ...protocol.checklist, [key]: e.target.checked },
                  });
                }}
              />
              {CHECKLIST_LABELS[key]}
            </label>
          ))}
        </div>
      </div>

      <label className="block">
        <span className={OPS_LABEL_CLASS}>Daune / observații</span>
        <textarea
          className={OPS_INPUT_CLASS}
          rows={2}
          disabled={!canWrite || !draft || pending}
          defaultValue={protocol.damageNotes ?? ""}
          onBlur={(e) => {
            if (e.target.value !== (protocol.damageNotes ?? "")) {
              void saveFields({ damageNotes: e.target.value || null });
            }
          }}
        />
      </label>

      <div>
        <span className={OPS_LABEL_CLASS}>Foto stare ({protocol.media.length})</span>
        {canWrite && draft ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {MEDIA_KINDS.map((k) => (
              <label
                key={k}
                className="cursor-pointer rounded border border-zinc-700 px-2 py-1.5 text-xs text-zinc-300"
              >
                + {k}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  disabled={pending}
                  onChange={(e) => void onPhoto(k, e.target.files?.[0] ?? null)}
                />
              </label>
            ))}
          </div>
        ) : null}
        {protocol.media.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs text-zinc-500">
            {protocol.media.map((m) => (
              <li key={m.id}>
                <a href={m.fileUrl} target="_blank" rel="noreferrer" className="text-sky-400">
                  {m.kind}
                </a>
                {m.fileName ? ` · ${m.fileName}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div>
        <span className={OPS_LABEL_CLASS}>
          Semnături ({protocol.signatures.length}) — minim șofer +{" "}
          {protocol.kind === "pickup" ? "client" : "recepție"}
        </span>
        {protocol.signatures.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs text-zinc-400">
            {protocol.signatures.map((s) => (
              <li key={s.id}>
                {s.role}: {s.displayName}
              </li>
            ))}
          </ul>
        ) : null}

        {canWrite && draft ? (
          <div className="mt-3 space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className={OPS_LABEL_CLASS}>Rol semnatar</span>
                <select
                  className={OPS_INPUT_CLASS}
                  value={signerRole}
                  disabled={pending}
                  onChange={(e) => setSignerRole(e.target.value as RsaHandoverSignerRole)}
                >
                  <option value="driver">Șofer asistență</option>
                  {protocol.kind === "pickup" ? (
                    <option value="customer">Client / reprezentant</option>
                  ) : (
                    <option value="receiver">Recepție destinatar</option>
                  )}
                  <option value="witness">Martor</option>
                </select>
              </label>
              <label className="block">
                <span className={OPS_LABEL_CLASS}>Nume complet</span>
                <input
                  className={OPS_INPUT_CLASS}
                  value={signerName}
                  disabled={pending}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="ex. Ion Popescu"
                />
              </label>
            </div>
            <RsaSignaturePad ref={padRef} disabled={pending} enableLandscapeLock />
            <button
              type="button"
              disabled={pending}
              onClick={() => void submitSignature(signerRole, signerName)}
              className="w-full rounded-lg bg-zinc-100 px-3 py-3 text-sm font-medium text-zinc-900 disabled:opacity-50 sm:w-auto"
            >
              Salvează semnătura pe ecran
            </button>
          </div>
        ) : null}
      </div>

      {canWrite && draft ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void onFinalize()}
          className="w-full rounded-lg bg-emerald-700 px-3 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          Finalizează PV (blochează editarea)
        </button>
      ) : null}
    </div>
  );
}
