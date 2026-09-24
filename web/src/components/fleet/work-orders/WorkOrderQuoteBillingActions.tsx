"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { OpsReminderFields } from "@/components/fleet/OpsReminderFields";
import { OPS_INPUT_CLASS, OPS_LABEL_CLASS } from "@/components/fleet/ops-form-primitives";
import { InvoiceAttachmentField } from "@/components/fleet/work-orders/InvoiceAttachmentField";
import {
  defaultDayOffsetsForMode,
  defaultKmOffsets,
  hasConfiguredOpsReminder,
  inferReminderConstraintMode,
  type ReminderConstraintMode,
} from "@/lib/ops-reminder-fields";
import {
  formatQuoteMoney,
  type QuoteSummary,
  type ServiceCaseWorkflowType,
} from "@/lib/service-cases-api";
import { fleetJsonHeaders, workOrdersBrowserBase } from "@/lib/work-orders-api";

type Props = {
  workOrderId: string;
  workOrderStatus: string;
  quote: QuoteSummary;
  canWrite: boolean;
  compact?: boolean;
  workflowType?: ServiceCaseWorkflowType | string;
  vehicleOdometerKm?: number;
  ticketSettlement?: {
    entityType: "maintenance" | "cost" | "document";
    entityId: string;
    createdAt: string;
  } | null;
  onUpdated: () => void;
};

export function WorkOrderQuoteBillingActions({
  workOrderId,
  workOrderStatus,
  quote,
  canWrite,
  compact = false,
  workflowType,
  vehicleOdometerKm = 0,
  ticketSettlement = null,
  onUpdated,
}: Props) {
  const [invoiceNumber, setInvoiceNumber] = useState(quote.invoiceNumber ?? "");
  const [invoiceDate, setInvoiceDate] = useState(
    quote.invoiceDate ? quote.invoiceDate.slice(0, 10) : "",
  );
  const [invoiceAttachmentUrl, setInvoiceAttachmentUrl] = useState(quote.invoiceAttachmentUrl ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReminder, setShowReminder] = useState(false);
  const isItp = workflowType === "itp";
  const [constraintMode, setConstraintMode] = useState<ReminderConstraintMode>(() =>
    isItp ? "time" : inferReminderConstraintMode({}),
  );
  const [dueDate, setDueDate] = useState("");
  const [reminderOffsetsDays, setReminderOffsetsDays] = useState<number[]>(() =>
    isItp ? defaultDayOffsetsForMode(true) : [],
  );
  const [dueOdometerKm, setDueOdometerKm] = useState<number | null>(null);
  const [reminderOffsetsKm, setReminderOffsetsKm] = useState<number[]>([]);
  const [syncReminderAction, setSyncReminderAction] = useState(true);

  const reminderConfigured = useMemo(
    () =>
      hasConfiguredOpsReminder({
        mode: constraintMode,
        dueDate,
        reminderOffsetsDays,
        dueOdometerKm,
        reminderOffsetsKm,
      }),
    [constraintMode, dueDate, reminderOffsetsDays, dueOdometerKm, reminderOffsetsKm],
  );

  if (quote.status !== "approved") return null;

  const showComplete =
    canWrite &&
    workOrderStatus !== "cancelled" &&
    (!!quote.costEntryId || !!ticketSettlement);

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
          body: JSON.stringify({
            invoiceNumber: invoiceNumber.trim(),
            invoiceDate,
            invoiceAttachmentUrl: invoiceAttachmentUrl.trim() || null,
          }),
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
    if (ticketSettlement) {
      const kind =
        ticketSettlement.entityType === "maintenance"
          ? "Mentenanță"
          : ticketSettlement.entityType === "cost"
            ? "Cost"
            : "Document";
      const date = new Date(ticketSettlement.createdAt).toLocaleDateString("ro-RO");
      const ok = window.confirm(
        `ATENȚIE: această reparație a fost transformată în ${kind} la data ${date}.\n\nSunteți sigur că vreți să generați încă un cost din deviz?`,
      );
      if (!ok) return;
    }
    setPending(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      if (showReminder && reminderConfigured) {
        if (constraintMode === "time" || constraintMode === "both") {
          body.nextDueOn = dueDate || null;
          body.reminderOffsetsDays = reminderOffsetsDays;
        }
        if (constraintMode === "km" || constraintMode === "both") {
          body.dueOdometerKm = dueOdometerKm;
          body.reminderOffsetsKm = reminderOffsetsKm.length ? reminderOffsetsKm : defaultKmOffsets();
        }
        body.syncReminderAction = syncReminderAction;
      }
      const res = await fetch(
        `${workOrdersBrowserBase}/${workOrderId}/quotes/${quote.id}/post-cost`,
        { method: "POST", headers: fleetJsonHeaders(), body: JSON.stringify(body) },
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
        <div
          className={`rounded-lg border border-emerald-700/50 bg-emerald-950/30 ${compact ? "p-2.5" : "p-3"}`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400/90">
            Factură înregistrată
          </p>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
            <span className="font-medium text-emerald-100">
              {quote.invoiceNumber?.trim() || "Fără număr"}
            </span>
            {quote.invoiceDate ? (
              <span className="text-xs text-zinc-400">
                {new Date(quote.invoiceDate).toLocaleDateString("ro-RO")}
              </span>
            ) : null}
            {quote.invoiceAttachmentUrl ? (
              <a
                href={quote.invoiceAttachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded border border-violet-500/40 bg-violet-950/40 px-2 py-0.5 text-xs font-medium text-violet-200 hover:bg-violet-900/40"
              >
                PDF factură →
              </a>
            ) : (
              <span className="text-[10px] text-zinc-500">Fără PDF</span>
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-500">
            {quote.costEntryId ? (
              <>
                Cost:{" "}
                <Link href={`/fleet/costs/${quote.costEntryId}`} className="text-sky-300 hover:underline">
                  deschide înregistrarea
                </Link>
              </>
            ) : (
              <>
                Detalii pe{" "}
                <Link href={`/fleet/work-orders/${workOrderId}`} className="text-sky-300 hover:underline">
                  comandă
                </Link>
              </>
            )}
          </p>
        </div>
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
            <InvoiceAttachmentField
              value={invoiceAttachmentUrl}
              onChange={setInvoiceAttachmentUrl}
              invoiceNumber={invoiceNumber}
              disabled={pending}
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
        <div className="space-y-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={showReminder}
              onChange={(e) => {
                setShowReminder(e.target.checked);
                if (e.target.checked && isItp && !dueDate) {
                  setReminderOffsetsDays(defaultDayOffsetsForMode(true));
                }
              }}
              className="rounded border-zinc-600"
            />
            Creează reminder la generarea costului
          </label>
          {showReminder ? (
            <OpsReminderFields
              constraintMode={constraintMode}
              onConstraintModeChange={setConstraintMode}
              dueDate={dueDate}
              onDueDateChange={setDueDate}
              dueDateLabel={isItp ? "ITP valabil până la" : "Următoarea acțiune (dată)"}
              dueDateHint={isItp ? "Recomandat pentru flux ITP." : undefined}
              reminderOffsetsDays={reminderOffsetsDays}
              onReminderOffsetsDaysChange={setReminderOffsetsDays}
              dueOdometerKm={dueOdometerKm}
              onDueOdometerKmChange={setDueOdometerKm}
              reminderOffsetsKm={reminderOffsetsKm}
              onReminderOffsetsKmChange={setReminderOffsetsKm}
              vehicleOdometerKm={vehicleOdometerKm}
              syncReminderAction={syncReminderAction}
              onSyncReminderActionChange={setSyncReminderAction}
              disabled={pending}
              isItp={isItp}
              fixedMode={isItp ? "time" : undefined}
            />
          ) : null}
          <button
            type="button"
            disabled={pending}
            onClick={() => void postCost()}
            className="rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50"
          >
            Generează cost din deviz
          </button>
        </div>
      ) : !quote.invoicedAt ? (
        <p className="text-xs text-zinc-500">După factură: generezi costul automat.</p>
      ) : null}

      {showComplete ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void completeWorkOrder()}
          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {workOrderStatus === "done" ? "Închide dosarul" : "Finalizează comanda"}
        </button>
      ) : null}
    </div>
  );
}
