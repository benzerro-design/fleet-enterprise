"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  DRIVER_DOCUMENT_TYPE_OPTIONS,
  driverDocumentTypeLabel,
} from "@/lib/driver-document-types";
import { documentExpiryBadge, documentExpiryStatus } from "@/lib/document-expiry";
import { uploadDocumentFile } from "@/lib/document-upload";
import { driversBrowserBase, fleetJsonHeaders, type DriverDocumentRecord } from "@/lib/drivers-api";

const inputClass =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100";

type Props = {
  driverId: string;
  initialDocuments: DriverDocumentRecord[];
  canWrite: boolean;
};

async function readError(res: Response): Promise<string> {
  let msg = `HTTP ${res.status}`;
  try {
    const j = (await res.json()) as { message?: string | string[] };
    if (typeof j.message === "string") msg = j.message;
    else if (Array.isArray(j.message)) msg = j.message.join(", ");
  } catch {
    /* ignore */
  }
  return msg;
}

export function DriverDocumentsPanel({ driverId, initialDocuments, canWrite }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState(initialDocuments);
  const [documentTypeCode, setDocumentTypeCode] = useState("permis");
  const [title, setTitle] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [notes, setNotes] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = `${driversBrowserBase}/${driverId}/documents`;

  async function refresh() {
    const res = await fetch(base);
    if (res.ok) {
      setDocuments((await res.json()) as DriverDocumentRecord[]);
    }
    router.refresh();
  }

  async function onFileChange(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadDocumentFile(file, title.trim() || documentTypeCode);
      setFileUrl(uploaded.url);
      setFileName(uploaded.name);
      if (!title.trim()) {
        setTitle(uploaded.name.replace(/\.[^.]+$/, ""));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload eșuat");
    } finally {
      setUploading(false);
    }
  }

  async function onAdd() {
    if (!title.trim()) {
      setError("Titlul documentului este obligatoriu.");
      return;
    }
    if (!fileUrl.trim()) {
      setError("Încarcă un fișier (PDF sau imagine).");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          documentTypeCode,
          title: title.trim(),
          fileUrl,
          fileName: fileName || null,
          expiresOn: expiresOn.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      setTitle("");
      setExpiresOn("");
      setNotes("");
      setFileUrl("");
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
      await refresh();
    } finally {
      setPending(false);
    }
  }

  async function onDelete(documentId: string) {
    if (!window.confirm("Ștergi acest document?")) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${base}/${documentId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        setError(await readError(res));
        return;
      }
      await refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <h2 className="text-lg font-medium text-zinc-100">Documente șofer</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Permis scanat, ADR, medicina muncii și alte documente obligatorii.
      </p>

      {documents.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">Niciun document încărcat.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {documents.map((d) => {
            const expiry = documentExpiryStatus(d.expiresOn);
            const badge = documentExpiryBadge(expiry);
            return (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <a
                    href={d.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-emerald-300 hover:underline"
                  >
                    {d.title}
                  </a>
                  <p className="text-xs text-zinc-500">
                    {driverDocumentTypeLabel(d.documentTypeCode)}
                    {d.fileName ? ` · ${d.fileName}` : ""}
                    {d.expiresOn
                      ? ` · exp. ${new Date(d.expiresOn).toLocaleDateString("ro-RO")}`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {expiry !== "none" && expiry !== "valid" ? (
                    <span
                      className={`rounded border px-2 py-0.5 text-xs font-medium ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  ) : null}
                  {canWrite ? (
                    <button
                      type="button"
                      onClick={() => onDelete(d.id)}
                      disabled={pending}
                      className="text-rose-400 hover:underline disabled:opacity-60"
                    >
                      Șterge
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {canWrite ? (
        <div className="mt-6 border-t border-zinc-800 pt-5">
          <h3 className="text-sm font-medium text-zinc-300">Încarcă document</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-zinc-500">Tip document</label>
              <select
                value={documentTypeCode}
                onChange={(e) => setDocumentTypeCode(e.target.value)}
                className={`mt-1 ${inputClass}`}
              >
                {DRIVER_DOCUMENT_TYPE_OPTIONS.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500">Titlu</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`mt-1 ${inputClass}`}
                placeholder="ex. Permis 2026"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500">Valabil până la (opțional)</label>
              <input
                type="date"
                value={expiresOn}
                onChange={(e) => setExpiresOn(e.target.value)}
                className={`mt-1 ${inputClass}`}
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500">Fișier (PDF, JPEG, PNG)</label>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp"
                disabled={uploading || pending}
                onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-sm file:text-zinc-200"
              />
              {uploading ? <p className="mt-1 text-xs text-zinc-500">Se încarcă…</p> : null}
              {fileUrl ? (
                <p className="mt-1 text-xs text-emerald-400">Fișier încărcat: {fileName || "document"}</p>
              ) : null}
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-zinc-500">Note (opțional)</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={`mt-1 ${inputClass}`}
              />
            </div>
          </div>
          {error ? <p className="mt-2 text-sm text-rose-400">{error}</p> : null}
          <button
            type="button"
            disabled={pending || uploading}
            onClick={onAdd}
            className="mt-3 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700 disabled:opacity-60"
          >
            {pending ? "Se salvează…" : "Adaugă document"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
