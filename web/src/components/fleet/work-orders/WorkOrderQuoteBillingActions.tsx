"use client";

import Link from "next/link";
import { useState } from "react";
import { OPS_INPUT_CLASS, OPS_LABEL_CLASS } from "@/components/fleet/ops-form-primitives";
import {
  formatQuoteMoney,
  type QuoteSummary,
} from "@/lib/service-cases-api";
import { fleetJsonHeaders, workOrdersBrowserBase } from "@/lib/work-orders-api";

type Props = {
  workOrderId: string;
  workOrderStatus: string;
  quote: QuoteSummary;
  canWrite: boolean;
  compact?: boolean;
  onUpdated: () => void;
};

export function WorkOrderQuoteBillingActions({
  workOrderId,
  workOrderStatus,
  quote,
  canWrite,
  compact = false,
  onUpdated,
}: Props) {
  const [invoiceNumber, setInvoiceNumber] = useState(quote.invoiceNumber ?? "");
  const [invoiceDate, setInvoiceDate] = useState(
    quote.invoiceDate ? quote.invoiceDate.slice(0, 10) : "",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (quote.status !== "approved") return null;

  const canComplete =
    canWrite &&
    workOrderStatus !== "done" &&
    workOrderStatus !== "cancelled" &&
    !!quote.invoicedAt &&
    !!quote.costEntryId;

  async function recordInvoice() {
    if (!invoiceNumber.trim() || !invoiceDate) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(
        `${workOrdersBrowserBase}/${workOrderId}/quotes/${quote.id}/record-invoice`,
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
      onUpdated();
    } finally {
      setPending(false);
    }
  }

  async function postCost() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(
        `${workOrdersBrowserBase}/${workOrderId}/quotes/${quote.id}/post-cost`,
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
      onUpdated();
    } finally {
      setPending(false);
    }
  }

  async function completeWorkOrder() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${workOrdersBrowserBase}/${workOrderId}/complete`, {
        method: "POST",
        headers: fleetJsonHeaders(),
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
      onUpdated();
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className={`space-y-3 rounded-md border border-amber-800/40 bg-amber-950/15 ${compact ? "mt-2 p-2.5" : "mt-4 p-3"}`}
    >
      <p className="text-[10px] uppercase text-amber-300/80">Factură, cost și închidere</p>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}

      {quote.invoicedAt ? (
        <p className="text-xs text-emerald-300">
          Factură: {quote.invoiceNumber ?? "—"}
          {quote.invoiceDate
            ? ` · ${new Date(quote.invoiceDate).toLocaleDateString("ro-RO")}`
            : ""}
        </p>
      ) : canWrite ? (
        <div className="grid gap-2 sm:grid-cols-2">
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
              className="rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            >
              Înregistrează factura
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-zinc-500">Factura nu a fost încă înregistrată.</p>
      )}

      {quote.costEntryId ? (
        <p className="text-xs text-zinc-300">
          Cost:{" "}
          <Link href={`/fleet/costs/${quote.costEntryId}`} className="text-sky-300 hover:underline">
            {formatQuoteMoney(quote.totalGrossCents, quote.currency)}
          </Link>
        </p>
      ) : quote.invoicedAt && canWrite ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void postCost()}
          className="rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50"
        >
          Generează cost din deviz
        </button>
      ) : !quote.invoicedAt ? (
        <p className="text-xs text-zinc-500">După factură: generezi costul automat.</p>
      ) : null}

      {canComplete ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void completeWorkOrder()}
          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          Finalizează comanda service
        </button>
      ) : null}
    </div>
  );
}
