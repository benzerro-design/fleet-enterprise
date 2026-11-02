"use client";

import { useState } from "react";
import {
  rsaDropoffMapsUrl,
  rsaMissionDropoffQrPayload,
  rsaQrImageUrl,
} from "@/lib/rsa-offline-queue";

type Props = {
  missionId: string;
  dropoffLocationText?: string | null;
  vehicleReg?: string | null;
  compact?: boolean;
};

export function RsaDropoffQr({
  missionId,
  dropoffLocationText,
  vehicleReg,
  compact,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const payload = rsaMissionDropoffQrPayload({
    missionId,
    dropoffLocationText,
    vehicleReg,
  });
  const maps = rsaDropoffMapsUrl(dropoffLocationText);
  const qrSrc = !imgFailed ? rsaQrImageUrl(payload, compact ? 120 : 160) : null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(payload);
    } catch {
      window.prompt("Copiază payload QR:", payload);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className={
        compact
          ? "flex min-w-0 items-start gap-3"
          : "space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3"
      }
    >
      {qrSrc ? (
        <div className="shrink-0 space-y-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSrc}
            alt="QR destinatar misiune"
            width={compact ? 120 : 160}
            height={compact ? 120 : 160}
            className="rounded-md border border-zinc-700 bg-white p-1"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
          <p className="max-w-[160px] text-[9px] leading-tight text-zinc-600">
            QR destinatar (scan pe teren)
          </p>
        </div>
      ) : null}
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-xs font-medium text-zinc-200">Destinație predare</p>
        <p className="text-sm text-zinc-300">
          {dropoffLocationText?.trim() || "Fără adresă — doar ID misiune"}
        </p>
        <code className="block break-all font-mono text-[10px] text-zinc-500">{payload}</code>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void copy()}
            className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-200"
          >
            {copied ? "Copiat" : "Copiază payload"}
          </button>
          {maps ? (
            <a
              href={maps}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-sky-800/60 px-2 py-1 text-[11px] text-sky-300"
            >
              Deschide în Maps
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
