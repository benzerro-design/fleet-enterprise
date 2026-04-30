"use client";

import { useMemo, useState } from "react";

type Props = {
  summary: string;
  meta: unknown;
};

export function AuditDetailExpandable({ summary, meta }: Props) {
  const [showJson, setShowJson] = useState(false);

  const jsonPretty = useMemo(() => {
    if (meta === null || meta === undefined) return null;
    try {
      return JSON.stringify(meta, null, 2);
    } catch {
      return String(meta);
    }
  }, [meta]);

  const hasStructuredMeta =
    jsonPretty !== null && jsonPretty !== "{}" && jsonPretty !== "[]" && jsonPretty !== "null";

  return (
    <div className="space-y-2">
      <p className="leading-relaxed text-zinc-300">{summary}</p>
      {hasStructuredMeta ? (
        <>
          <button
            type="button"
            onClick={() => setShowJson((v) => !v)}
            className="text-xs text-emerald-400 hover:text-emerald-300 hover:underline"
          >
            {showJson ? "Ascunde meta brut (JSON)" : "Arată meta brut (JSON)"}
          </button>
          {showJson ? (
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs text-zinc-400">
              {jsonPretty}
            </pre>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
