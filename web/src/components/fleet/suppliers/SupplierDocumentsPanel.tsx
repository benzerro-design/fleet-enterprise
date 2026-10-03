"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { uploadSupplierDocument } from "@/lib/supplier-document-upload";
import {
  fleetJsonHeaders,
  suppliersBrowserBase,
  type SupplierDocumentCompliance,
  type SupplierDocumentKind,
  type SupplierDocumentRecord,
} from "@/lib/suppliers-api";
import {
  DEFAULT_ONBOARDING_DOC_KINDS,
  supplierSettingsBrowserBase,
} from "@/lib/supplier-settings";

const FALLBACK_KINDS: Array<{ value: SupplierDocumentKind; label: string; requiredByDefault: boolean }> =
  DEFAULT_ONBOARDING_DOC_KINDS.filter((k) => k.enabled).map((k) => ({
    value: k.code,
    label: k.label,
    requiredByDefault: k.requiredByDefault,
  }));

function statusLabel(status: SupplierDocumentRecord["expiryStatus"]): string {
  switch (status) {
    case "expired":
      return "Expirat";
    case "expiring_soon":
      return "Expiră curând";
    case "valid":
      return "Valid";
    default:
      return "Fără expirare";
  }
}

function statusClass(status: SupplierDocumentRecord["expiryStatus"]): string {
  switch (status) {
    case "expired":
      return "text-rose-400";
    case "expiring_soon":
      return "text-amber-300";
    case "valid":
      return "text-emerald-400";
    default:
      return "text-zinc-400";
  }
}

type Props = {
  supplierId: string;
  canWrite: boolean;
};

export function SupplierDocumentsPanel({ supplierId, canWrite }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<SupplierDocumentRecord[]>([]);
  const [compliance, setCompliance] = useState<SupplierDocumentCompliance | null>(null);
  const [kinds, setKinds] = useState(FALLBACK_KINDS);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<SupplierDocumentKind>("itp_auth");
  const [title, setTitle] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [required, setRequired] = useState(true);

  const load = useCallback(async () => {
    try {
      const [docsRes, settingsRes] = await Promise.all([
        fetch(`${suppliersBrowserBase}/${supplierId}/documents`, {
          cache: "no-store",
          headers: fleetJsonHeaders(),
        }),
        fetch(supplierSettingsBrowserBase, { cache: "no-store", headers: fleetJsonHeaders() }),
      ]);
      if (docsRes.ok) {
        const data = (await docsRes.json()) as {
          items: SupplierDocumentRecord[];
          compliance: SupplierDocumentCompliance;
        };
        setItems(data.items ?? []);
        setCompliance(data.compliance ?? null);
      }
      if (settingsRes.ok) {
        const s = (await settingsRes.json()) as {
          onboardingDocKinds?: Array<{
            code: string;
            label: string;
            enabled: boolean;
            requiredByDefault: boolean;
          }>;
        };
        const next = (s.onboardingDocKinds ?? [])
          .filter((k) => k.enabled)
          .map((k) => ({
            value: k.code,
            label: k.label,
            requiredByDefault: k.requiredByDefault,
          }));
        if (next.length) {
          setKinds(next);
          setKind((prev) => (next.some((k) => k.value === prev) ? prev : next[0].value));
        }
      }
    } catch {
      /* ignore */
    }
  }, [supplierId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const label = kinds.find((k) => k.value === kind)?.label ?? "Document";
    setTitle((prev) => (prev.trim() ? prev : label));
  }, [kind]);

  async function onFile(files: FileList | null) {
    if (!files?.[0] || !canWrite) return;
    setPending(true);
    setError(null);
    try {
      const uploaded = await uploadSupplierDocument(files[0], supplierId);
      const res = await fetch(`${suppliersBrowserBase}/${supplierId}/documents`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          kind,
          title: title.trim() || kinds.find((k) => k.value === kind)?.label || "Document",
          fileUrl: uploaded.url,
          fileName: uploaded.name,
          mimeType: uploaded.mimeType,
          expiresOn: expiresOn.trim() || null,
          required,
        }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string };
          if (j.message) msg = j.message;
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      setExpiresOn("");
      setRequired(true);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload eșuat");
    } finally {
      setPending(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove(docId: string) {
    if (!canWrite) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${suppliersBrowserBase}/${supplierId}/documents/${docId}`, {
        method: "DELETE",
        headers: fleetJsonHeaders(),
      });
      if (!res.ok && res.status !== 204) {
        setError(`HTTP ${res.status}`);
        return;
      }
      await load();
    } finally {
      setPending(false);
    }
  }

  async function toggleRequired(doc: SupplierDocumentRecord) {
    if (!canWrite) return;
    setPending(true);
    try {
      await fetch(`${suppliersBrowserBase}/${supplierId}/documents/${doc.id}`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({ required: !doc.required }),
      });
      await load();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      {compliance && !compliance.ok ? (
        <p className="rounded-lg border border-rose-800/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
          Compliance documente:{" "}
          {[
            compliance.expiredRequired.length
              ? `expirate — ${compliance.expiredRequired.map((d) => d.title).join(", ")}`
              : null,
            compliance.missingRequiredKinds?.length
              ? `lipsă — ${compliance.missingRequiredKinds.map((d) => d.label).join(", ")}`
              : null,
          ]
            .filter(Boolean)
            .join("; ")}
          . Acceptul de comenzi e blocat până la remediere.
        </p>
      ) : null}
      {compliance && compliance.expiringSoon.length > 0 ? (
        <p className="rounded-lg border border-amber-800/40 bg-amber-950/20 px-3 py-2 text-sm text-amber-200">
          Expiră în curând:{" "}
          {compliance.expiringSoon
            .map((d) => `${d.title} (${d.daysLeft}z)`)
            .join(", ")}
          .
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {canWrite ? (
        <div className="grid gap-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 sm:grid-cols-2">
          <label className="text-xs text-zinc-500">
            Tip
            <select
              value={kind}
              onChange={(e) => {
                const v = e.target.value as SupplierDocumentKind;
                setKind(v);
                const meta = kinds.find((k) => k.value === v);
                if (meta) setRequired(meta.requiredByDefault);
              }}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-200"
            >
              {kinds.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-zinc-500">
            Titlu
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-200"
            />
          </label>
          <label className="text-xs text-zinc-500">
            Expiră la
            <input
              type="date"
              value={expiresOn}
              onChange={(e) => setExpiresOn(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-200"
            />
          </label>
          <label className="flex items-end gap-2 pb-1 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="rounded border-zinc-600"
            />
            Obligatoriu (blochează comenzi la expirare)
          </label>
          <div className="sm:col-span-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => void onFile(e.target.files)}
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => fileRef.current?.click()}
              className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {pending ? "Se încarcă…" : "+ Upload document"}
            </button>
          </div>
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">Niciun document încărcat.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-[10px] uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="pb-2 pr-2 font-medium">Tip</th>
                <th className="pb-2 pr-2 font-medium">Status</th>
                <th className="pb-2 pr-2 font-medium">Expiră</th>
                <th className="pb-2 pr-2 font-medium">Încărcat</th>
                <th className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {items.map((d) => (
                <tr key={d.id} className="text-zinc-300">
                  <td className="py-2 pr-2">
                    <p className="font-medium text-zinc-100">{d.title}</p>
                    <p className="text-[10px] text-zinc-500">
                      {kinds.find((k) => k.value === d.kind)?.label ?? d.kind}
                      {d.required ? " · obligatoriu" : ""}
                    </p>
                  </td>
                  <td className={`py-2 pr-2 ${statusClass(d.expiryStatus)}`}>
                    {statusLabel(d.expiryStatus)}
                  </td>
                  <td className="py-2 pr-2 text-zinc-400">{d.expiresOn ?? "—"}</td>
                  <td className="py-2 pr-2 text-zinc-500">
                    {d.createdAt.slice(0, 10)}
                    <br />
                    <a
                      href={d.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-sky-400 hover:underline"
                    >
                      {d.fileName}
                    </a>
                  </td>
                  <td className="py-2 text-right">
                    {canWrite ? (
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => void toggleRequired(d)}
                          className="text-[10px] text-zinc-400 hover:text-zinc-200"
                        >
                          {d.required ? "Opțional" : "Obligatoriu"}
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => void remove(d.id)}
                          className="text-[10px] text-rose-400 hover:text-rose-300"
                        >
                          Șterge
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
