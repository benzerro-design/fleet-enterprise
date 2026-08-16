"use client";

import { useMemo, useState } from "react";
import { OPS_INPUT_CLASS, OPS_LABEL_CLASS } from "@/components/fleet/ops-form-primitives";
import { uploadDocumentFile } from "@/lib/document-upload";
import { fleetJsonHeaders } from "@/lib/fleet-api";
import {
  formatMoneyCents,
  quoteLineTypeLabel,
  workOrdersBrowserBase,
  type QuoteLineInput,
} from "@/lib/work-orders-api";

export type QuoteImportPreviewLine = {
  lineType: "labor" | "parts" | "other";
  description: string;
  quantity: number;
  unitNetCents: number;
  vatRatePercent: number;
  partNumber: string | null;
  confidence: number;
  raw?: string;
};

type PreviewResponse = {
  formatDetected: "audatex" | "generic" | "unknown";
  parser?: "audatex-v1" | "generic-v1" | "none";
  warnings: string[];
  summary?: {
    parts: number;
    labor: number;
    other: number;
    lowConfidence: number;
  };
  lines: QuoteImportPreviewLine[];
  ocrError?: string | null;
};

type EditableImportLine = QuoteImportPreviewLine & { key: string; selected: boolean };
type ReviewFilter = "all" | "parts" | "labor" | "other" | "low";

type Props = {
  workOrderId: string;
  open: boolean;
  onClose: () => void;
  onApplied: () => void;
};

function centsToLei(cents: number): string {
  return (cents / 100).toFixed(2);
}

function leiToCents(value: string): number {
  const n = parseFloat(value.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return NaN;
  return Math.round(n * 100);
}

function formatBadge(format: PreviewResponse["formatDetected"], parser?: string) {
  if (format === "audatex") {
    return {
      label: parser === "audatex-v1" ? "Audatex · parser v1" : "Audatex",
      className: "border-emerald-600/50 bg-emerald-950/40 text-emerald-100",
    };
  }
  if (format === "generic") {
    return {
      label: "Generic",
      className: "border-zinc-600 bg-zinc-900 text-zinc-300",
    };
  }
  return {
    label: "Nereunoscut",
    className: "border-amber-600/50 bg-amber-950/30 text-amber-100",
  };
}

export function QuoteImportModal({ workOrderId, open, onClose, onApplied }: Props) {
  const [pasteText, setPasteText] = useState("");
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [lines, setLines] = useState<EditableImportLine[]>([]);
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCount = useMemo(() => lines.filter((l) => l.selected).length, [lines]);
  const visibleLines = useMemo(() => {
    return lines.filter((l) => {
      if (filter === "all") return true;
      if (filter === "low") return l.confidence < 0.6;
      return l.lineType === filter;
    });
  }, [lines, filter]);

  const liveSummary = useMemo(() => {
    const s = { parts: 0, labor: 0, other: 0, lowConfidence: 0 };
    for (const l of lines) {
      if (l.lineType === "parts") s.parts += 1;
      else if (l.lineType === "labor") s.labor += 1;
      else s.other += 1;
      if (l.confidence < 0.6) s.lowConfidence += 1;
    }
    return s;
  }, [lines]);

  if (!open) return null;

  async function onPickFile(file: File | null) {
    if (!file) return;
    setPending(true);
    setError(null);
    try {
      const up = await uploadDocumentFile(file, "Import deviz");
      setFileUrl(up.url);
      setFileLabel(up.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload eșuat");
    } finally {
      setPending(false);
    }
  }

  async function runPreview() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${workOrdersBrowserBase}/${workOrderId}/quotes/import-preview`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          text: pasteText.trim() || null,
          fileUrl: fileUrl || null,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as PreviewResponse;
      setPreview(data);
      setFilter("all");
      setLines(
        (data.lines ?? []).map((line) => ({
          ...line,
          key: Math.random().toString(36).slice(2),
          selected: true,
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview eșuat");
    } finally {
      setPending(false);
    }
  }

  async function applyImport() {
    const selected = lines.filter((l) => l.selected);
    if (!selected.length) {
      setError("Selectează cel puțin o linie.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const payloadLines: QuoteImportPreviewLine[] = selected.map((l) => ({
        lineType: l.lineType,
        description: l.description,
        quantity: l.quantity,
        unitNetCents: l.unitNetCents,
        vatRatePercent: l.vatRatePercent,
        partNumber: l.partNumber,
        confidence: l.confidence,
      }));
      const res = await fetch(`${workOrdersBrowserBase}/${workOrderId}/quotes/import-apply`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({ lines: payloadLines, replaceExistingDraft: true }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      onApplied();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import eșuat");
    } finally {
      setPending(false);
    }
  }

  function updateLine(key: string, patch: Partial<EditableImportLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center">
      <div
        role="dialog"
        aria-modal
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950 p-4 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Import deviz PDF</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Încarcă PDF/scan sau lipește text → verifică liniile → salvează ca ciornă.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-900"
          >
            Închide
          </button>
        </div>

        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className={OPS_LABEL_CLASS}>Fișier PDF / imagine</span>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              disabled={pending}
              className="block w-full text-xs text-zinc-300 file:mr-2 file:rounded file:border-0 file:bg-zinc-800 file:px-2 file:py-1 file:text-zinc-100"
              onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
            />
            {fileLabel ? (
              <span className="text-xs text-emerald-400/90">Încărcat: {fileLabel}</span>
            ) : (
              <span className="text-xs text-zinc-500">Opțional dacă lipești text.</span>
            )}
          </label>
          <label className="block space-y-1 sm:col-span-2">
            <span className={OPS_LABEL_CLASS}>Text lipit (fallback OCR)</span>
            <textarea
              className={`${OPS_INPUT_CLASS} min-h-[88px] font-mono text-xs`}
              value={pasteText}
              disabled={pending}
              placeholder="Lipește tabelul din PDF dacă OCR nu extrage bine…"
              onChange={(e) => setPasteText(e.target.value)}
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending || (!fileUrl && pasteText.trim().length < 20)}
            onClick={() => void runPreview()}
            className="rounded border border-violet-500/50 bg-violet-950/40 px-3 py-1.5 text-xs font-semibold text-violet-100 disabled:opacity-50"
          >
            {pending ? "Se procesează…" : "Extrage linii"}
          </button>
          {preview ? (
            <>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${formatBadge(preview.formatDetected, preview.parser).className}`}
              >
                {formatBadge(preview.formatDetected, preview.parser).label}
              </span>
              <span className="text-xs text-zinc-500">
                {liveSummary.parts} piese · {liveSummary.labor} manoperă · {liveSummary.other} altele
                {liveSummary.lowConfidence
                  ? ` · ${liveSummary.lowConfidence} conf. scăzută`
                  : ""}
              </span>
            </>
          ) : null}
        </div>

        {preview?.warnings?.length ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-200/90">
            {preview.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}

        {lines.length > 0 ? (
          <>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {(
                [
                  ["all", "Toate"],
                  ["parts", "Piese"],
                  ["labor", "Manoperă"],
                  ["other", "Altele"],
                  ["low", "Conf. scăzută"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={`rounded border px-2.5 py-1 text-xs ${
                    filter === id
                      ? "border-violet-500/50 bg-violet-950/40 text-violet-100"
                      : "border-zinc-700 text-zinc-400 hover:bg-zinc-900"
                  }`}
                >
                  {label}
                  {id === "low" && liveSummary.lowConfidence
                    ? ` (${liveSummary.lowConfidence})`
                    : ""}
                </button>
              ))}
            </div>

            <div className="mt-2 overflow-x-auto rounded-lg border border-zinc-800">
              <table className="min-w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-900/80 text-zinc-400">
                  <tr>
                    <th className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={visibleLines.length > 0 && visibleLines.every((l) => l.selected)}
                        onChange={(e) => {
                          const keys = new Set(visibleLines.map((l) => l.key));
                          setLines((prev) =>
                            prev.map((l) =>
                              keys.has(l.key) ? { ...l, selected: e.target.checked } : l,
                            ),
                          );
                        }}
                      />
                    </th>
                    <th className="px-2 py-2">Tip</th>
                    <th className="px-2 py-2">Descriere</th>
                    <th className="px-2 py-2">Cod</th>
                    <th className="px-2 py-2">Cant.</th>
                    <th className="px-2 py-2">Preț net</th>
                    <th className="px-2 py-2">Conf.</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLines.map((line) => (
                    <tr
                      key={line.key}
                      className={`border-t border-zinc-800/80 ${
                        line.confidence < 0.6 ? "bg-amber-950/20" : ""
                      }`}
                    >
                      <td className="px-2 py-1.5">
                        <input
                          type="checkbox"
                          checked={line.selected}
                          onChange={(e) => updateLine(line.key, { selected: e.target.checked })}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          className="rounded border border-zinc-700 bg-zinc-950 px-1 py-0.5"
                          value={line.lineType}
                          onChange={(e) =>
                            updateLine(line.key, {
                              lineType: e.target.value as QuoteLineInput["lineType"],
                            })
                          }
                        >
                          <option value="parts">{quoteLineTypeLabel("parts")}</option>
                          <option value="labor">{quoteLineTypeLabel("labor")}</option>
                          <option value="other">{quoteLineTypeLabel("other")}</option>
                        </select>
                      </td>
                      <td className="px-2 py-1.5 min-w-[12rem]">
                        <input
                          className="w-full rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5"
                          value={line.description}
                          onChange={(e) => updateLine(line.key, { description: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          className="w-24 rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 font-mono"
                          value={line.partNumber ?? ""}
                          onChange={(e) =>
                            updateLine(line.key, { partNumber: e.target.value.trim() || null })
                          }
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          className="w-16 rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5"
                          value={String(line.quantity)}
                          onChange={(e) => {
                            const q = parseFloat(e.target.value.replace(",", "."));
                            updateLine(line.key, {
                              quantity: Number.isFinite(q) && q > 0 ? q : line.quantity,
                            });
                          }}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          className="w-20 rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 font-mono"
                          value={centsToLei(line.unitNetCents)}
                          onChange={(e) => {
                            const c = leiToCents(e.target.value);
                            if (Number.isFinite(c)) updateLine(line.key, { unitNetCents: c });
                          }}
                        />
                        <div className="mt-0.5 text-[10px] text-zinc-500">
                          {formatMoneyCents(line.unitNetCents)}
                        </div>
                      </td>
                      <td
                        className={`px-2 py-1.5 font-mono ${
                          line.confidence < 0.6 ? "text-amber-300" : "text-zinc-500"
                        }`}
                        title={line.raw}
                      >
                        {Math.round(line.confidence * 100)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {visibleLines.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">Nicio linie pe filtrul curent.</p>
            ) : null}
          </>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900"
          >
            Anulează
          </button>
          <button
            type="button"
            disabled={pending || selectedCount === 0}
            onClick={() => void applyImport()}
            className="rounded border border-emerald-600/50 bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-100 disabled:opacity-50"
          >
            Salvează ciornă ({selectedCount})
          </button>
        </div>
      </div>
    </div>
  );
}
