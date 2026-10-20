"use client";

import { useState } from "react";
import { tireSetQrImageUrl } from "@/lib/tire-set-search";

type Props = {
  payload: string;
  compact?: boolean;
  /** When true, show optional QR image via api.qrserver.com (external). */
  showQrImage?: boolean;
};

export function TireHotelQrPayload({ payload, compact = false, showQrImage = true }: Props) {
  const [copied, setCopied] = useState(false);
  const [qrImageFailed, setQrImageFailed] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(payload);
    } catch {
      window.prompt("Copiază codul QR:", payload);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  const qrSrc = showQrImage && !qrImageFailed ? tireSetQrImageUrl(payload) : null;

  return (
    <div className={compact ? "flex min-w-0 items-start gap-2" : "space-y-2"}>
      {qrSrc ? (
        <div className="shrink-0 space-y-0.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSrc}
            alt=""
            width={120}
            height={120}
            className="rounded-md border border-zinc-700 bg-white p-1"
            loading="lazy"
            onError={() => setQrImageFailed(true)}
          />
          <p className="max-w-[120px] text-[9px] leading-tight text-zinc-600">
            QR extern (api.qrserver.com)
          </p>
        </div>
      ) : null}
      <div className={compact ? "min-w-0 flex-1 space-y-1" : "space-y-1.5"}>
        <code
          className={`block min-w-0 break-all font-mono text-[11px] leading-snug text-zinc-400 ${compact ? "" : "text-xs sm:text-sm"}`}
        >
          {payload}
        </code>
        <button
          type="button"
          onClick={() => void copy()}
          className="shrink-0 rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-200 hover:bg-zinc-800"
        >
          {copied ? "Copiat" : "Copiază"}
        </button>
      </div>
    </div>
  );
}
