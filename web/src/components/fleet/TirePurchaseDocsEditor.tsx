"use client";

import { useEffect, useState } from "react";
import { fleetJsonHeaders } from "@/lib/fleet-api";

function purchaseDocsToText(docs: unknown): string {
  if (docs == null) return "";
  if (typeof docs === "string") return docs;
  if (Array.isArray(docs)) {
    return docs
      .map((x) => (typeof x === "string" ? x : x != null ? JSON.stringify(x) : ""))
      .filter(Boolean)
      .join("\n");
  }
  if (typeof docs === "object") {
    const o = docs as Record<string, unknown>;
    if (Array.isArray(o.urls)) {
      return o.urls.filter((u): u is string => typeof u === "string").join("\n");
    }
    try {
      return JSON.stringify(docs, null, 2);
    } catch {
      return "";
    }
  }
  return "";
}

function textToPurchaseDocs(text: string): string[] | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines : null;
}

type Props = {
  /** PATCH endpoint for set docs */
  saveUrl: string;
  initialWarrantyUrl?: string | null;
  initialPurchaseDocs?: unknown;
  canWrite: boolean;
  onSaved?: (next: {
    warrantyCertificateUrl: string | null;
    purchaseDocs: unknown;
  }) => void;
};

export function TirePurchaseDocsEditor({
  saveUrl,
  initialWarrantyUrl = null,
  initialPurchaseDocs = null,
  canWrite,
  onSaved,
}: Props) {
  const [warrantyUrl, setWarrantyUrl] = useState(initialWarrantyUrl?.trim() ?? "");
  const [purchaseText, setPurchaseText] = useState(() => purchaseDocsToText(initialPurchaseDocs));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    setWarrantyUrl(initialWarrantyUrl?.trim() ?? "");
    setPurchaseText(purchaseDocsToText(initialPurchaseDocs));
    setError(null);
    setInfo(null);
  }, [initialWarrantyUrl, initialPurchaseDocs, saveUrl]);

  async function save() {
    if (!canWrite) return;
    setPending(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(saveUrl, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          warrantyCertificateUrl: warrantyUrl.trim() || null,
          purchaseDocs: textToPurchaseDocs(purchaseText),
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const next = (await res.json()) as {
        warrantyCertificateUrl?: string | null;
        purchaseDocs?: unknown;
      };
      const warrantyCertificateUrl = next.warrantyCertificateUrl ?? null;
      const purchaseDocs = next.purchaseDocs ?? null;
      setWarrantyUrl(warrantyCertificateUrl?.trim() ?? "");
      setPurchaseText(purchaseDocsToText(purchaseDocs));
      setInfo("Documente salvate.");
      onSaved?.({ warrantyCertificateUrl, purchaseDocs });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvare eșuată");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Documente achiziție / garanție
      </h4>
      <label className="block text-[11px] text-zinc-500">
        URL certificat garanție
        <input
          value={warrantyUrl}
          onChange={(e) => setWarrantyUrl(e.target.value)}
          disabled={!canWrite || pending}
          placeholder="https://…"
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 disabled:opacity-50"
        />
      </label>
      <label className="block text-[11px] text-zinc-500">
        Documente achiziție (un URL pe linie sau JSON)
        <textarea
          value={purchaseText}
          onChange={(e) => setPurchaseText(e.target.value)}
          disabled={!canWrite || pending}
          rows={3}
          placeholder={"https://factura.pdf\nhttps://garantie.pdf"}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-xs text-zinc-100 disabled:opacity-50"
        />
      </label>
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      {info ? <p className="text-xs text-emerald-400/90">{info}</p> : null}
      {canWrite ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void save()}
          className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? "Se salvează…" : "Salvează documente"}
        </button>
      ) : (
        <p className="text-[11px] text-zinc-600">Doar citire.</p>
      )}
    </div>
  );
}
