"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { OPS_INPUT_CLASS, OPS_LABEL_CLASS } from "@/components/fleet/ops-form-primitives";
import {
  fleetJsonHeaders,
  formatMoneyCents,
  quoteLineTypeLabel,
  quoteStatusLabel,
  workOrdersBrowserBase,
  type QuoteLineInput,
  type WorkOrderQuoteRecord,
  type WorkOrderQuoteStatus,
} from "@/lib/work-orders-api";

type EditableLine = {
  key: string;
  lineType: QuoteLineInput["lineType"];
  description: string;
  quantity: string;
  unitNetLei: string;
  vatRatePercent: string;
  partNumber: string;
};

function newLine(): EditableLine {
  return {
    key: Math.random().toString(36).slice(2),
    lineType: "parts",
    description: "",
    quantity: "1",
    unitNetLei: "",
    vatRatePercent: "19",
    partNumber: "",
  };
}

function leiToCents(value: string): number {
  const n = parseFloat(value.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return NaN;
  return Math.round(n * 100);
}

function centsToLei(cents: number): string {
  return (cents / 100).toFixed(2);
}

function linesFromQuote(quote: WorkOrderQuoteRecord): EditableLine[] {
  if (quote.lines.length === 0) return [newLine()];
  return quote.lines.map((line) => ({
    key: line.id,
    lineType: line.lineType,
    description: line.description,
    quantity: String(line.quantity),
    unitNetLei: centsToLei(line.unitNetCents),
    vatRatePercent: String(line.vatRatePercent),
    partNumber: line.partNumber ?? "",
  }));
}

function toPayload(lines: EditableLine[]): QuoteLineInput[] {
  return lines.map((line, idx) => ({
    lineType: line.lineType,
    description: line.description,
    quantity: parseFloat(line.quantity.replace(",", ".")) || 1,
    unitNetCents: leiToCents(line.unitNetLei),
    vatRatePercent: parseInt(line.vatRatePercent, 10) || 19,
    partNumber: line.partNumber || null,
    sortOrder: idx,
  }));
}

function statusBadgeClass(status: WorkOrderQuoteStatus): string {
  switch (status) {
    case "draft":
      return "border-zinc-600 text-zinc-300";
    case "submitted":
      return "border-amber-500/50 text-amber-200";
    case "approved":
      return "border-emerald-500/50 text-emerald-200";
    case "rejected":
      return "border-red-500/50 text-red-200";
    default:
      return "border-zinc-600 text-zinc-300";
  }
}

type Props = {
  workOrderId: string;
  canWrite: boolean;
  canApprove?: boolean;
};

export function WorkOrderQuotePanel({ workOrderId, canWrite, canApprove = false }: Props) {
  const [quotes, setQuotes] = useState<WorkOrderQuoteRecord[] | undefined>(undefined);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [lines, setLines] = useState<EditableLine[]>([newLine()]);
  const [notes, setNotes] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${workOrdersBrowserBase}/${workOrderId}/quotes`);
      if (!res.ok) {
        setQuotes([]);
        return;
      }
      const data = (await res.json()) as WorkOrderQuoteRecord[];
      setQuotes(data);
      const draft = data.find((q) => q.status === "draft");
      const selected = draft ?? data[0] ?? null;
      setActiveId(selected?.id ?? null);
      if (selected?.status === "draft") {
        setLines(linesFromQuote(selected));
        setNotes(selected.notes ?? "");
      }
      if (selected?.costInvoiceNumber) setInvoiceNumber(selected.costInvoiceNumber);
      if (selected?.costInvoiceDate) {
        setInvoiceDate(selected.costInvoiceDate.slice(0, 10));
      }
    } catch {
      setQuotes([]);
    }
  }, [workOrderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeQuote = useMemo(
    () => quotes?.find((q) => q.id === activeId) ?? null,
    [quotes, activeId],
  );

  const draftQuote = quotes?.find((q) => q.status === "draft") ?? null;
  const isEditingDraft = activeQuote?.status === "draft";

  const previewTotals = useMemo(() => {
    let net = 0;
    let vat = 0;
    for (const line of lines) {
      const unit = leiToCents(line.unitNetLei);
      const qty = parseFloat(line.quantity.replace(",", ".")) || 0;
      const rate = parseInt(line.vatRatePercent, 10) || 0;
      if (!Number.isFinite(unit) || unit < 0 || qty <= 0) continue;
      const lineNet = Math.round(qty * unit);
      const lineVat = Math.round((lineNet * rate) / 100);
      net += lineNet;
      vat += lineVat;
    }
    return { net, vat, gross: net + vat };
  }, [lines]);

  async function saveDraft() {
    setPending(true);
    setError(null);
    try {
      const payload = { lines: toPayload(lines), notes: notes || null };
      for (const line of payload.lines) {
        if (!line.description?.trim()) {
          setError("Completați descrierea pentru toate liniile.");
          return;
        }
        if (!Number.isFinite(line.unitNetCents) || line.unitNetCents < 0) {
          setError("Preț unitar invalid.");
          return;
        }
      }

      const url = draftQuote
        ? `${workOrdersBrowserBase}/${workOrderId}/quotes/${draftQuote.id}`
        : `${workOrdersBrowserBase}/${workOrderId}/quotes`;
      const res = await fetch(url, {
        method: draftQuote ? "PATCH" : "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string };
          if (j.message) msg = j.message;
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      await load();
    } finally {
      setPending(false);
    }
  }

  async function postCost() {
    if (!activeQuote) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(
        `${workOrdersBrowserBase}/${workOrderId}/quotes/${activeQuote.id}/post-cost`,
        { method: "POST", headers: fleetJsonHeaders() },
      );
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string };
          if (j.message) msg = j.message;
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      await load();
    } finally {
      setPending(false);
    }
  }

  async function recordInvoice() {
    if (!activeQuote || !invoiceNumber.trim() || !invoiceDate) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(
        `${workOrdersBrowserBase}/${workOrderId}/quotes/${activeQuote.id}/record-invoice`,
        {
          method: "POST",
          headers: fleetJsonHeaders(),
          body: JSON.stringify({ invoiceNumber: invoiceNumber.trim(), invoiceDate }),
        },
      );
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string };
          if (j.message) msg = j.message;
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      await load();
    } finally {
      setPending(false);
    }
  }

  async function quoteAction(action: "submit" | "approve" | "reject") {
    if (!activeQuote) return;
    setPending(true);
    setError(null);
    try {
      let body: string | undefined;
      if (action === "reject") {
        const reason = window.prompt("Motiv respingere (opțional):") ?? "";
        body = JSON.stringify({ reason });
      }
      const res = await fetch(
        `${workOrdersBrowserBase}/${workOrderId}/quotes/${activeQuote.id}/${action}`,
        {
          method: "POST",
          headers: fleetJsonHeaders(),
          body,
        },
      );
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string };
          if (j.message) msg = j.message;
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      await load();
    } finally {
      setPending(false);
    }
  }

  function startNewDraft() {
    setActiveId(null);
    setLines([newLine()]);
    setNotes("");
  }

  if (quotes === undefined) {
    return (
      <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <p className="text-sm text-zinc-500">Se încarcă devizele…</p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">Deviz</h2>
          <p className="mt-1 text-xs text-zinc-500">Linii structurate, trimitere și aprobare</p>
        </div>
        {canWrite && !draftQuote ? (
          <button
            type="button"
            onClick={startNewDraft}
            className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
          >
            Deviz nou
          </button>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

      {quotes.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {quotes.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => {
                setActiveId(q.id);
                if (q.status === "draft") {
                  setLines(linesFromQuote(q));
                  setNotes(q.notes ?? "");
                }
                if (q.costInvoiceNumber) setInvoiceNumber(q.costInvoiceNumber);
                if (q.costInvoiceDate) setInvoiceDate(q.costInvoiceDate.slice(0, 10));
              }}
              className={`rounded-full border px-2.5 py-1 text-xs ${
                activeId === q.id ? "border-sky-500/60 bg-sky-950/40" : "border-zinc-700"
              } ${statusBadgeClass(q.status)}`}
            >
              v{q.version} · {quoteStatusLabel(q.status)}
            </button>
          ))}
        </div>
      ) : null}

      {activeQuote && !isEditingDraft ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-4 text-sm">
            <span>
              Total net: <strong>{formatMoneyCents(activeQuote.totalNetCents, activeQuote.currency)}</strong>
            </span>
            <span>
              TVA: <strong>{formatMoneyCents(activeQuote.totalVatCents, activeQuote.currency)}</strong>
            </span>
            <span>
              Total: <strong>{formatMoneyCents(activeQuote.totalGrossCents, activeQuote.currency)}</strong>
            </span>
          </div>
          {activeQuote.rejectionReason ? (
            <p className="text-sm text-red-300">Motiv respingere: {activeQuote.rejectionReason}</p>
          ) : null}
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
                <th className="py-2 pr-2">Tip</th>
                <th className="py-2 pr-2">Descriere</th>
                <th className="py-2 pr-2">Cant.</th>
                <th className="py-2 pr-2">Preț unit.</th>
                <th className="py-2 pr-2">TVA %</th>
                <th className="py-2">Total net</th>
              </tr>
            </thead>
            <tbody>
              {activeQuote.lines.map((line) => (
                <tr key={line.id} className="border-b border-zinc-800/60">
                  <td className="py-2 pr-2 text-zinc-400">{quoteLineTypeLabel(line.lineType)}</td>
                  <td className="py-2 pr-2">{line.description}</td>
                  <td className="py-2 pr-2 font-mono">{line.quantity}</td>
                  <td className="py-2 pr-2 font-mono">{formatMoneyCents(line.unitNetCents)}</td>
                  <td className="py-2 pr-2">{line.vatRatePercent}%</td>
                  <td className="py-2 font-mono">{formatMoneyCents(line.lineNetCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {canApprove && activeQuote.status === "submitted" ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => void quoteAction("approve")}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                Aprobă deviz
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => void quoteAction("reject")}
                className="rounded-lg border border-red-500/50 px-3 py-1.5 text-sm text-red-200 hover:bg-red-950/40 disabled:opacity-50"
              >
                Respinge
              </button>
            </div>
          ) : null}

          {activeQuote.status === "approved" ? (
            <div className="mt-4 space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
              <p className="text-xs uppercase text-zinc-500">Factură & cost</p>

              {activeQuote.invoicedAt ? (
                <p className="text-sm text-emerald-300">
                  Factură: {activeQuote.costInvoiceNumber ?? "—"}
                  {activeQuote.costInvoiceDate
                    ? ` · ${new Date(activeQuote.costInvoiceDate).toLocaleDateString("ro-RO")}`
                    : ""}
                </p>
              ) : canWrite ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={OPS_LABEL_CLASS}>Nr. factură</label>
                    <input
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className={OPS_INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className={OPS_LABEL_CLASS}>Data facturii</label>
                    <input
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      className={OPS_INPUT_CLASS}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      disabled={pending || !invoiceNumber.trim() || !invoiceDate}
                      onClick={() => void recordInvoice()}
                      className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm text-white hover:bg-violet-500 disabled:opacity-50"
                    >
                      Înregistrează factura
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">Factura nu a fost încă înregistrată.</p>
              )}

              {activeQuote.costEntryId ? (
                <p className="text-sm">
                  Cost înregistrat:{" "}
                  <Link href={`/fleet/costs/${activeQuote.costEntryId}`} className="text-sky-300 hover:underline">
                    deschide costul
                  </Link>
                  {" · "}
                  {formatMoneyCents(activeQuote.totalGrossCents, activeQuote.currency)}
                </p>
              ) : activeQuote.invoicedAt && canWrite ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void postCost()}
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-500 disabled:opacity-50"
                >
                  Generează cost din deviz
                </button>
              ) : !activeQuote.invoicedAt ? (
                <p className="text-sm text-zinc-500">Înregistrează factura înainte de cost.</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {(isEditingDraft || quotes.length === 0 || (!activeQuote && canWrite)) && canWrite ? (
        <div className="mt-4 space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
                  <th className="py-2 pr-2">Tip</th>
                  <th className="py-2 pr-2">Descriere</th>
                  <th className="py-2 pr-2">Cant.</th>
                  <th className="py-2 pr-2">Preț net (lei)</th>
                  <th className="py-2 pr-2">TVA %</th>
                  <th className="py-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={line.key} className="border-b border-zinc-800/60">
                    <td className="py-2 pr-2">
                      <select
                        value={line.lineType}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = { ...line, lineType: e.target.value as EditableLine["lineType"] };
                          setLines(next);
                        }}
                        className={OPS_INPUT_CLASS}
                      >
                        <option value="parts">Piese</option>
                        <option value="labor">Manoperă</option>
                        <option value="other">Altele</option>
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        value={line.description}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = { ...line, description: e.target.value };
                          setLines(next);
                        }}
                        className={OPS_INPUT_CLASS}
                        placeholder="Descriere linie"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        value={line.quantity}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = { ...line, quantity: e.target.value };
                          setLines(next);
                        }}
                        className={`${OPS_INPUT_CLASS} w-20`}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        value={line.unitNetLei}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = { ...line, unitNetLei: e.target.value };
                          setLines(next);
                        }}
                        className={`${OPS_INPUT_CLASS} w-28 font-mono`}
                        placeholder="0.00"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        value={line.vatRatePercent}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = { ...line, vatRatePercent: e.target.value };
                          setLines(next);
                        }}
                        className={`${OPS_INPUT_CLASS} w-16`}
                      />
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                        className="text-zinc-500 hover:text-red-400"
                        aria-label="Șterge linia"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() => setLines([...lines, newLine()])}
            className="text-xs text-sky-300 hover:underline"
          >
            + Linie
          </button>
          <div>
            <label className={OPS_LABEL_CLASS}>Notițe deviz</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={OPS_INPUT_CLASS}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
            <span>Previzualizare: {formatMoneyCents(previewTotals.net)} + TVA {formatMoneyCents(previewTotals.vat)}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => void saveDraft()}
              className="rounded-lg bg-zinc-700 px-3 py-1.5 text-sm text-white hover:bg-zinc-600 disabled:opacity-50"
            >
              Salvează ciornă
            </button>
            {draftQuote ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => void quoteAction("submit")}
                className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm text-white hover:bg-sky-500 disabled:opacity-50"
              >
                Trimite spre aprobare
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!canWrite && quotes.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">Nu există devize pentru această comandă.</p>
      ) : null}
    </section>
  );
}
