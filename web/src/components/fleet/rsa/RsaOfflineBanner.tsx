"use client";

import { useRsaOfflineSync } from "@/hooks/useRsaOfflineSync";

export function RsaOfflineBanner() {
  const { online, pendingCount, flushing, flush, lastFlush } = useRsaOfflineSync();

  if (online && pendingCount === 0 && !lastFlush?.failed) return null;

  return (
    <div
      className={`rounded-lg border px-3 py-2 text-sm ${
        online
          ? "border-amber-800/50 bg-amber-950/30 text-amber-100"
          : "border-rose-800/50 bg-rose-950/40 text-rose-100"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          {online
            ? pendingCount > 0
              ? `${pendingCount} acțiuni RSA în așteptare (offline queue)`
              : lastFlush?.failed
                ? `Sincronizare eșuată: ${lastFlush.errors[0] ?? "eroare"}`
                : null
            : `Offline — acțiunile se salvează local${pendingCount ? ` (${pendingCount})` : ""}`}
        </p>
        {online && pendingCount > 0 ? (
          <button
            type="button"
            disabled={flushing}
            onClick={() => void flush()}
            className="rounded border border-amber-700/60 px-2 py-1 text-xs text-amber-50 disabled:opacity-50"
          >
            {flushing ? "Se sincronizează…" : "Sincronizează acum"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
