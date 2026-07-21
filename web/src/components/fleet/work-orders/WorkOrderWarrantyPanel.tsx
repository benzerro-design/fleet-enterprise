"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { OPS_INPUT_CLASS, OPS_LABEL_CLASS } from "@/components/fleet/ops-form-primitives";
import {
  fleetJsonHeaders,
  quoteLineTypeLabel,
  workOrdersBrowserBase,
  type QuoteLineType,
} from "@/lib/work-orders-api";

type WarrantyStatus = "draft" | "active" | "locked";

type WarrantyLineRecord = {
  id: string;
  sortOrder: number;
  sourceQuoteLineId: string | null;
  lineType: QuoteLineType;
  description: string;
  partNumber: string | null;
  warrantyMonths: number;
  warrantyKm: number | null;
};

type WarrantyRecord = {
  id: string;
  workOrderId: string;
  sourceQuoteId: string | null;
  status: WarrantyStatus;
  startsAt: string | null;
  startsKm: number | null;
  conditionsPdfUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lines: WarrantyLineRecord[];
};

type EditableWarrantyLine = WarrantyLineRecord & {
  monthsInput: string;
  kmInput: string;
};

type Props = {
  workOrderId: string;
  canWrite: boolean;
  woStatus: string;
  outServiceAt: string | null;
};

function warrantyStatusLabel(status: WarrantyStatus | string): string {
  const map: Record<string, string> = {
    draft: "Ciornă",
    active: "Activă",
    locked: "Blocată",
  };
  return map[status] ?? status;
}

function toEditableLines(lines: WarrantyLineRecord[]): EditableWarrantyLine[] {
  return lines.map((line) => ({
    ...line,
    monthsInput: String(line.warrantyMonths),
    kmInput: line.warrantyKm == null ? "" : String(line.warrantyKm),
  }));
}

function parseOptionalKm(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return NaN;
  return Math.round(n);
}

function formatWarrantyDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ro-RO");
}

export function WorkOrderWarrantyPanel({ workOrderId, canWrite, woStatus, outServiceAt }: Props) {
  const [warranty, setWarranty] = useState<WarrantyRecord | null | undefined>(undefined);
  const [lines, setLines] = useState<EditableWarrantyLine[]>([]);
  const [conditionsPdfUrl, setConditionsPdfUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${workOrdersBrowserBase}/${workOrderId}/warranty`);
      if (res.status === 404) {
        setWarranty(null);
        return;
      }
      if (!res.ok) {
        setWarranty(null);
        return;
      }
      const data = (await res.json()) as WarrantyRecord | null;
      setWarranty(data);
      setLines(data ? toEditableLines(data.lines) : []);
      setConditionsPdfUrl(data?.conditionsPdfUrl ?? "");
      setNotes(data?.notes ?? "");
    } catch {
      setWarranty(null);
    }
  }, [workOrderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const canEdit = useMemo(
    () => canWrite && woStatus !== "done" && warranty?.status !== "locked",
    [canWrite, woStatus, warranty?.status],
  );

  async function syncFromQuote() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${workOrdersBrowserBase}/${workOrderId}/warranty/sync-from-quote`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as WarrantyRecord;
      setWarranty(data);
      setLines(toEditableLines(data.lines));
      setConditionsPdfUrl(data.conditionsPdfUrl ?? "");
      setNotes(data.notes ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la importul garanției");
    } finally {
      setPending(false);
    }
  }

  async function saveWarranty() {
    if (!warranty) return;
    setPending(true);
    setError(null);
    try {
      const payloadLines = lines.map((line) => {
        const months = Number(line.monthsInput);
        const km = parseOptionalKm(line.kmInput);
        if (!Number.isFinite(months) || months < 0 || Number.isNaN(km)) {
          throw new Error("Completați valori valide pentru luni și km garanție.");
        }
        return {
          id: line.id,
          warrantyMonths: Math.round(months),
          warrantyKm: km,
        };
      });
      const res = await fetch(`${workOrdersBrowserBase}/${workOrderId}/warranty`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({
          conditionsPdfUrl: conditionsPdfUrl.trim() || null,
          notes: notes.trim() || null,
          lines: payloadLines,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as WarrantyRecord;
      setWarranty(data);
      setLines(toEditableLines(data.lines));
      setConditionsPdfUrl(data.conditionsPdfUrl ?? "");
      setNotes(data.notes ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la salvarea garanției");
    } finally {
      setPending(false);
    }
  }

  if (warranty === undefined) {
    return <p className="mt-4 text-sm text-zinc-500">Se încarcă garanția…</p>;
  }

  if (!warranty) {
    return (
      <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
        <p className="text-sm font-medium text-zinc-200">Nu există garanție generată pentru această comandă.</p>
        <p className="mt-1 text-xs text-zinc-500">
          Importul folosește ultimul deviz aprobat și liniile aprobate.
        </p>
        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        {canWrite ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => void syncFromQuote()}
            className="mt-3 rounded-lg bg-violet-600 px-3 py-1.5 text-sm text-white hover:bg-violet-500 disabled:opacity-50"
          >
            Importă din deviz aprobat
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
          {warrantyStatusLabel(warranty.status)}
        </span>
        {warranty.status === "active" ? (
          <>
            <span className="text-zinc-400">
              Start: <strong className="text-zinc-200">{formatWarrantyDate(warranty.startsAt)}</strong>
            </span>
            <span className="text-zinc-400">
              Km start:{" "}
              <strong className="font-mono text-zinc-200">
                {warranty.startsKm == null ? "—" : `${warranty.startsKm.toLocaleString("ro-RO")} km`}
              </strong>
            </span>
          </>
        ) : null}
        {outServiceAt ? (
          <span className="text-xs text-zinc-500">Ieșire service: {formatWarrantyDate(outServiceAt)}</span>
        ) : null}
        {canEdit ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => void syncFromQuote()}
            className="ml-auto rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
          >
            Reimportă din deviz
          </button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
              <th className="py-2 pr-2">Descriere</th>
              <th className="py-2 pr-2">Tip</th>
              <th className="py-2 pr-2">Cod piesă</th>
              <th className="py-2 pr-2">Luni</th>
              <th className="py-2 pr-2">Km</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => (
              <tr key={line.id} className="border-b border-zinc-800/60">
                <td className="py-2 pr-2">{line.description}</td>
                <td className="py-2 pr-2 text-zinc-400">{quoteLineTypeLabel(line.lineType)}</td>
                <td className="py-2 pr-2 font-mono text-xs text-zinc-300">{line.partNumber ?? "—"}</td>
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    min={0}
                    value={line.monthsInput}
                    disabled={!canEdit || pending}
                    onChange={(e) => {
                      const next = [...lines];
                      next[idx] = { ...line, monthsInput: e.target.value };
                      setLines(next);
                    }}
                    className={`${OPS_INPUT_CLASS} w-24 font-mono`}
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    min={0}
                    value={line.kmInput}
                    disabled={!canEdit || pending}
                    onChange={(e) => {
                      const next = [...lines];
                      next[idx] = { ...line, kmInput: e.target.value };
                      setLines(next);
                    }}
                    className={`${OPS_INPUT_CLASS} w-28 font-mono`}
                    placeholder="fără limită"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={OPS_LABEL_CLASS}>URL condiții PDF</label>
          <input
            value={conditionsPdfUrl}
            disabled={!canEdit || pending}
            onChange={(e) => setConditionsPdfUrl(e.target.value)}
            className={OPS_INPUT_CLASS}
            placeholder="https://…"
          />
        </div>
        <div>
          <label className={OPS_LABEL_CLASS}>Notițe garanție</label>
          <textarea
            value={notes}
            disabled={!canEdit || pending}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={OPS_INPUT_CLASS}
          />
        </div>
      </div>

      {canEdit ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void saveWarranty()}
          className="rounded-lg bg-zinc-700 px-3 py-1.5 text-sm text-white hover:bg-zinc-600 disabled:opacity-50"
        >
          Salvează garanția
        </button>
      ) : (
        <p className="text-xs text-zinc-500">
          Garanția este read-only când comanda este finalizată sau garanția este blocată.
        </p>
      )}
    </div>
  );
}
