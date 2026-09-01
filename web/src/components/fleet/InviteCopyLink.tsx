"use client";

import { useState } from "react";

type Props = {
  url: string;
  /** Compact: doar buton, fără URL vizibil. */
  compact?: boolean;
};

export function InviteCopyLink({ url, compact = false }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponibil */
    }
  }

  const button = (
    <button
      type="button"
      onClick={() => void copy()}
      className="shrink-0 rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-200 hover:bg-zinc-800"
    >
      {copied ? "Copiat" : "Copiază"}
    </button>
  );

  if (compact) return button;

  return (
    <div className="mt-1 flex items-start gap-2">
      <p className="min-w-0 flex-1 break-all font-mono text-emerald-100">{url}</p>
      {button}
    </div>
  );
}
