"use client";

import { useState } from "react";

type Props = {
  value: string;
  onChange: (url: string) => void;
  invoiceNumber?: string;
  disabled?: boolean;
};

export function InvoiceAttachmentField({ value, onChange, invoiceNumber, disabled }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      if (invoiceNumber?.trim()) form.set("invoiceNumber", invoiceNumber.trim());
      const res = await fetch("/api/uploads/invoices", { method: "POST", body: form });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(j?.message ?? `Upload eșuat (${res.status})`);
      }
      const payload = (await res.json()) as { url: string };
      onChange(payload.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload eșuat");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-xs text-zinc-500">Factură PDF</label>
      <input
        type="file"
        accept="application/pdf"
        disabled={disabled || uploading}
        onChange={(e) => void onFileChange(e)}
        className="block w-full text-xs text-zinc-400 file:mr-3 file:rounded file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-xs file:text-white"
      />
      {uploading ? <p className="text-xs text-zinc-500">Se încarcă PDF…</p> : null}
      {error ? <p className="text-xs text-amber-300">{error}</p> : null}
      {value ? (
        <p className="text-xs">
          <a href={value} target="_blank" rel="noreferrer" className="text-violet-300 hover:underline">
            Deschide PDF încărcat
          </a>
        </p>
      ) : null}
    </div>
  );
}
