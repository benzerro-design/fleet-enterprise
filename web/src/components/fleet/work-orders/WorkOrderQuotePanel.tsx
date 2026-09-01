"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { OPS_INPUT_CLASS, OPS_LABEL_CLASS, fleetSheetTabClass } from "@/components/fleet/ops-form-primitives";
import { InvoiceAttachmentField } from "@/components/fleet/work-orders/InvoiceAttachmentField";
import { QuoteImportModal } from "@/components/fleet/work-orders/QuoteImportModal";
import { WorkOrderWarrantyPanel } from "@/components/fleet/work-orders/WorkOrderWarrantyPanel";
import { formatDateRo, toDateInput, toIsoFromDateInput } from "@/lib/datetime-local";
import {
  fleetJsonHeaders,
  formatMoneyCents,
  formatLineDiscount,
  computeQuoteLineMoney,
  quoteLineTypeLabel,
  quoteLinesIncludedInTotals,
  quoteStatusLabel,
  workOrdersBrowserBase,
  type QuoteLineApprovalStatus,
  type QuoteLineInput,
  type QuotePartsOrderStatus,
  type PartsPriceVerifyLineResult,
  type VerifyPartsPricesResult,
  type WorkOrderQuoteRecord,
  type WorkOrderQuoteStatus,
} from "@/lib/work-orders-api";

type SupplierDiscountDefaults = {
  partsDiscountPercent: number;
  laborDiscountPercent: number;
};

type EditableLine = {
  key: string;
  lineType: QuoteLineInput["lineType"];
  description: string;
  quantity: string;
  unitNetLei: string;
  vatRatePercent: string;
  discountPercent: string;
  discountLei: string;
  discountTouched: boolean;
  partNumber: string;
  partCodeExempt: boolean;
};

function formatDiscountPercentInput(n: number): string {
  if (!n) return "";
  const rounded = Math.round(n * 100) / 100;
  return String(rounded);
}

function defaultDiscountForType(
  lineType: QuoteLineInput["lineType"],
  discounts?: SupplierDiscountDefaults | null,
): number {
  if (!discounts) return 0;
  if (lineType === "parts") return discounts.partsDiscountPercent || 0;
  if (lineType === "labor") return discounts.laborDiscountPercent || 0;
  return 0;
}

function newLine(
  discounts?: SupplierDiscountDefaults | null,
  lineType: QuoteLineInput["lineType"] = "parts",
): EditableLine {
  return {
    key: Math.random().toString(36).slice(2),
    lineType,
    description: "",
    quantity: "1",
    unitNetLei: "",
    vatRatePercent: "21",
    discountPercent: formatDiscountPercentInput(defaultDiscountForType(lineType, discounts)),
    discountLei: "",
    discountTouched: false,
    partNumber: "",
    partCodeExempt: false,
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

function editableLineNetLabel(line: EditableLine): string {
  const unit = leiToCents(line.unitNetLei);
  const qty = parseFloat(line.quantity.replace(",", ".")) || 0;
  const rate = parseInt(line.vatRatePercent, 10) || 0;
  if (!Number.isFinite(unit) || unit < 0 || qty <= 0) return "—";
  const pct = parseFloat(line.discountPercent.replace(",", ".")) || 0;
  const disc = leiToCents(line.discountLei);
  return formatMoneyCents(
    computeQuoteLineMoney({
      quantity: qty,
      unitNetCents: unit,
      vatRatePercent: rate,
      discountPercent: pct,
      discountCents: Number.isFinite(disc) ? disc : 0,
    }).lineNetCents,
  );
}

function linesFromQuote(quote: WorkOrderQuoteRecord, discounts?: SupplierDiscountDefaults | null): EditableLine[] {
  if (quote.lines.length === 0) return [newLine(discounts)];
  return quote.lines.map((line) => ({
    key: line.id,
    lineType: line.lineType,
    description: line.description,
    quantity: String(line.quantity),
    unitNetLei: centsToLei(line.unitNetCents),
    vatRatePercent: String(line.vatRatePercent),
    discountPercent:
      (line.discountPercent ?? 0) > 0 ? formatDiscountPercentInput(line.discountPercent ?? 0) : "",
    discountLei:
      (line.discountPercent ?? 0) > 0 || !line.discountCents ? "" : centsToLei(line.discountCents),
    discountTouched: true,
    partNumber: line.partNumber ?? "",
    partCodeExempt: line.partCodeExempt,
  }));
}

function toPayload(lines: EditableLine[]): QuoteLineInput[] {
  return lines.map((line, idx) => ({
    lineType: line.lineType,
    description: line.description,
    quantity: parseFloat(line.quantity.replace(",", ".")) || 1,
    unitNetCents: leiToCents(line.unitNetLei),
    vatRatePercent: parseInt(line.vatRatePercent, 10) || 19,
    discountPercent: parseFloat(line.discountPercent.replace(",", ".")) || 0,
    discountCents: Number.isFinite(leiToCents(line.discountLei)) ? leiToCents(line.discountLei) : 0,
    partNumber: line.partNumber || null,
    partCodeExempt: line.partCodeExempt,
    sortOrder: idx,
  }));
}

function quoteSubtotalsFromLines(
  lines: WorkOrderQuoteRecord["lines"],
  decisions?: Record<string, QuoteLineApprovalStatus | undefined>,
) {
  const subtotalLines = quoteLinesIncludedInTotals(lines, decisions);
  let labor = 0;
  let parts = 0;
  let other = 0;
  let vat = 0;
  for (const line of subtotalLines) {
    if (line.lineType === "labor") labor += line.lineNetCents;
    else if (line.lineType === "parts") parts += line.lineNetCents;
    else other += line.lineNetCents;
    vat += line.lineVatCents;
  }
  const rejectedCount = lines.length - subtotalLines.length;
  return { labor, parts, other, vat, gross: labor + parts + other + vat, rejectedCount };
}

function QuoteSubtotals({
  labor,
  parts,
  other,
  vat,
  gross,
  rejectedCount = 0,
  currency = "RON",
}: {
  labor: number;
  parts: number;
  other: number;
  vat: number;
  gross: number;
  rejectedCount?: number;
  currency?: string;
}) {
  return (
    <div className="ml-auto w-full max-w-xs space-y-1 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm">
      <SubtotalRow label="Subtotal manoperă" cents={labor} currency={currency} />
      <SubtotalRow label="Subtotal piese" cents={parts} currency={currency} />
      <SubtotalRow label="Subtotal altele" cents={other} currency={currency} />
      <SubtotalRow label="TVA" cents={vat} currency={currency} />
      <SubtotalRow label="Total brut" cents={gross} currency={currency} bold />
      {rejectedCount > 0 ? (
        <p className="pt-1 text-[11px] text-zinc-500">
          Fără {rejectedCount} {rejectedCount === 1 ? "linie respinsă" : "linii respinse"}
        </p>
      ) : null}
    </div>
  );
}

function SubtotalRow({
  label,
  cents,
  currency,
  bold,
}: {
  label: string;
  cents: number;
  currency: string;
  bold?: boolean;
}) {
  return (
    <div className={`flex justify-between gap-4 ${bold ? "font-semibold text-zinc-100" : "text-zinc-400"}`}>
      <span>{label}</span>
      <span className="font-mono">{formatMoneyCents(cents, currency)}</span>
    </div>
  );
}

const sheetBtnClass =
  "inline-flex h-7 items-center justify-center rounded border px-2.5 text-xs whitespace-nowrap disabled:opacity-50";

const partsOrderLabels: Record<QuotePartsOrderStatus, string> = {
  none: "Nicio comandă",
  ordered: "Comandate",
  in_stock: "În stoc",
  delivered: "Livrate",
};

const approvalLabels: Record<QuoteLineApprovalStatus, string> = {
  pending: "În așteptare",
  approved: "Aprobată",
  rejected: "Respinsă",
};

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
  /** Cost din factură — doar flotă (L* / L1). Partenerul încarcă factura, nu generează cost. */
  canPostCost?: boolean;
  /** Ascunde link-ul către /fleet/costs (portal partener). */
  isPartner?: boolean;
  sheetLayout?: boolean;
  estimatedRepairAt?: string | null;
  quoteLocked?: boolean;
  workOrderStatus?: string;
  outServiceAt?: string | null;
  requirePartCode?: boolean;
  allowQuotePdfImport?: boolean;
  allowPartsPriceVerify?: boolean;
  allowPartsOrderLaunch?: boolean;
  /** Lansare comenzi: admin client/tenant sau partener (nu dispatcher). */
  canLaunchPartsOrders?: boolean;
  ticketSettlement?: {
    entityType: "maintenance" | "cost" | "document";
    entityId: string;
    createdAt: string;
  } | null;
  supplierDiscounts?: SupplierDiscountDefaults | null;
};

export function WorkOrderQuotePanel({
  workOrderId,
  canWrite,
  canApprove = false,
  canPostCost = true,
  sheetLayout = false,
  estimatedRepairAt = null,
  quoteLocked = false,
  workOrderStatus = "",
  outServiceAt = null,
  requirePartCode = true,
  allowQuotePdfImport = true,
  allowPartsPriceVerify = true,
  allowPartsOrderLaunch = false,
  canLaunchPartsOrders = false,
  ticketSettlement = null,
  isPartner = false,
  supplierDiscounts = null,
}: Props) {
  const router = useRouter();
  const [quotes, setQuotes] = useState<WorkOrderQuoteRecord[] | undefined>(undefined);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"quote" | "warranty">("quote");
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [lines, setLines] = useState<EditableLine[]>(() => [newLine(supplierDiscounts)]);
  const [notes, setNotes] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [invoiceAttachmentUrl, setInvoiceAttachmentUrl] = useState("");
  const [lineDecisions, setLineDecisions] = useState<Record<string, QuoteLineApprovalStatus | undefined>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [launchOpen, setLaunchOpen] = useState(false);
  const [launchExpectedOn, setLaunchExpectedOn] = useState("");
  const [launchChannel, setLaunchChannel] = useState<"intercars" | "manual">("manual");
  const [launchSelected, setLaunchSelected] = useState<Record<string, boolean>>({});
  const [launchInfo, setLaunchInfo] = useState<string | null>(null);
  const [priceVerify, setPriceVerify] = useState<VerifyPartsPricesResult | null>(null);
  const [priceVerifyByKey, setPriceVerifyByKey] = useState<Record<string, PartsPriceVerifyLineResult>>({});
  const [estimatedDate, setEstimatedDate] = useState(() => toDateInput(estimatedRepairAt));

  useEffect(() => {
    setEstimatedDate(toDateInput(estimatedRepairAt));
  }, [estimatedRepairAt]);

  const hasEstimatedRepair = Boolean(estimatedRepairAt || toIsoFromDateInput(estimatedDate));

  const saveEstimatedRepair = useCallback(async (): Promise<boolean> => {
    if (quoteLocked) return true;
    const iso = toIsoFromDateInput(estimatedDate);
    if (!iso) {
      setError("Completați data estimativă de finalizare reparație.");
      return false;
    }
    if (estimatedRepairAt && toDateInput(estimatedRepairAt) === estimatedDate) return true;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${workOrdersBrowserBase}/${workOrderId}`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({ estimatedRepairAt: iso }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la salvarea estimării");
      return false;
    } finally {
      setPending(false);
    }
  }, [estimatedDate, estimatedRepairAt, quoteLocked, workOrderId, router]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${workOrdersBrowserBase}/${workOrderId}/quotes`);
      if (!res.ok) {
        setQuotes([]);
        return [] as WorkOrderQuoteRecord[];
      }
      const data = (await res.json()) as WorkOrderQuoteRecord[];
      setQuotes(data);
      const draft = data.find((q) => q.status === "draft");
      const selected = draft ?? data[0] ?? null;
      setActiveId(selected?.id ?? null);
      setEditingDraftId((current) => (current && data.some((q) => q.id === current && q.status === "draft") ? current : null));
      setLineDecisions({});
      if (selected?.status === "draft") {
        setLines(linesFromQuote(selected));
        setNotes(selected.notes ?? "");
      }
      if (selected?.costInvoiceNumber) setInvoiceNumber(selected.costInvoiceNumber);
      if (selected?.costInvoiceDate) {
        setInvoiceDate(selected.costInvoiceDate.slice(0, 10));
      }
      if (selected?.invoiceAttachmentUrl) setInvoiceAttachmentUrl(selected.invoiceAttachmentUrl);
      return data;
    } catch {
      setQuotes([]);
      return [] as WorkOrderQuoteRecord[];
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
  const isEditingDraft = activeQuote?.status === "draft" && editingDraftId === activeQuote.id;
  const isCreatingDraft = !activeQuote && canWrite;
  const hasLineDecisions = Object.values(lineDecisions).some(Boolean);

  const previewTotals = useMemo(() => {
    let net = 0;
    let vat = 0;
    let labor = 0;
    let parts = 0;
    let other = 0;
    for (const line of lines) {
      const unit = leiToCents(line.unitNetLei);
      const qty = parseFloat(line.quantity.replace(",", ".")) || 0;
      const rate = parseInt(line.vatRatePercent, 10) || 0;
      if (!Number.isFinite(unit) || unit < 0 || qty <= 0) continue;
      const pct = parseFloat(line.discountPercent.replace(",", ".")) || 0;
      const discCents = leiToCents(line.discountLei);
      const money = computeQuoteLineMoney({
        quantity: qty,
        unitNetCents: unit,
        vatRatePercent: rate,
        discountPercent: pct,
        discountCents: Number.isFinite(discCents) ? discCents : 0,
      });
      const lineNet = money.lineNetCents;
      const lineVat = money.lineVatCents;
      net += lineNet;
      vat += lineVat;
      if (line.lineType === "labor") labor += lineNet;
      else if (line.lineType === "parts") parts += lineNet;
      else other += lineNet;
    }
    return { net, vat, gross: net + vat, labor, parts, other };
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
        if (requirePartCode && line.lineType === "parts" && !line.partCodeExempt && !line.partNumber?.trim()) {
          setError("Completați codul piesei sau bifați „fără cod”.");
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
      setEditingDraftId(null);
    } finally {
      setPending(false);
    }
  }

  async function postCost() {
    if (!activeQuote) return;
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
      await load();
    } finally {
      setPending(false);
    }
  }

  async function quoteAction(
    action: "submit" | "approve" | "reject",
    approveBody?: { lineDecisions?: { lineId: string; status: "approved" | "rejected" }[] },
  ) {
    if (!activeQuote) return;
    if (action === "submit") {
      const ok = await saveEstimatedRepair();
      if (!ok) return;
    }
    setPending(true);
    setError(null);
    try {
      let body: string | undefined;
      if (action === "reject") {
        const reason = window.prompt("Motiv respingere (opțional):") ?? "";
        body = JSON.stringify({ reason });
      } else if (action === "approve" && approveBody) {
        body = JSON.stringify(approveBody);
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
      setLineDecisions({});
    } finally {
      setPending(false);
    }
  }

  async function approveSelection() {
    if (!activeQuote) return;
    const decisions = activeQuote.lines.map((line) => ({ lineId: line.id, status: lineDecisions[line.id] }));
    if (decisions.some((line) => !line.status)) {
      setError("Alegeți aprobat/respins pentru fiecare linie.");
      return;
    }
    if (!decisions.some((line) => line.status === "approved")) {
      setError("Selecția trebuie să conțină cel puțin o linie aprobată.");
      return;
    }
    await quoteAction("approve", {
      lineDecisions: decisions.map((line) => ({
        lineId: line.lineId,
        status: line.status as "approved" | "rejected",
      })),
    });
  }

  async function patchLineParts(
    lineId: string,
    body: { partsOrderStatus?: QuotePartsOrderStatus; partsExpectedOn?: string | null },
  ) {
    if (!activeQuote) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${workOrdersBrowserBase}/${workOrderId}/quotes/${activeQuote.id}/lines/${lineId}/parts`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la actualizarea pieselor");
    } finally {
      setPending(false);
    }
  }

  function startNewDraft() {
    setActiveId(null);
    setEditingDraftId(null);
    setLines([newLine(supplierDiscounts)]);
    setNotes("");
    setPriceVerify(null);
    setPriceVerifyByKey({});
  }

  async function verifyPartsPrices() {
    const quoteList = quotes ?? [];
    const payloadLines =
      isEditingDraft || isCreatingDraft || quoteList.length === 0
        ? lines.map((line) => ({
            key: line.key,
            lineType: line.lineType,
            partNumber: line.partNumber || null,
            unitNetCents: leiToCents(line.unitNetLei) || 0,
          }))
        : (activeQuote?.lines ?? []).map((line) => ({
            key: line.id,
            lineType: line.lineType,
            partNumber: line.partNumber,
            unitNetCents: line.unitNetCents,
          }));

    if (!payloadLines.some((l) => l.lineType === "parts")) {
      setError("Nu există linii de tip piese de verificat.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${workOrdersBrowserBase}/${workOrderId}/quotes/verify-parts-prices`, {
        method: "POST",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({ lines: payloadLines }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as VerifyPartsPricesResult;
      setPriceVerify(data);
      const byKey: Record<string, PartsPriceVerifyLineResult> = {};
      for (const row of data.lines) byKey[row.key] = row;
      setPriceVerifyByKey(byKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verificare preț eșuată");
      setPriceVerify(null);
      setPriceVerifyByKey({});
    } finally {
      setPending(false);
    }
  }

  function applyCatalogPrice(lineKey: string) {
    const hit = priceVerifyByKey[lineKey];
    if (hit?.bestUnitNetCents == null) return;
    setLines((prev) =>
      prev.map((line) =>
        line.key === lineKey ? { ...line, unitNetLei: centsToLei(hit.bestUnitNetCents!) } : line,
      ),
    );
  }

  function openLaunchParts() {
    if (!activeQuote) return;
    const initial: Record<string, boolean> = {};
    for (const line of activeQuote.lines) {
      if (
        line.lineType === "parts" &&
        line.approvalStatus !== "rejected" &&
        line.partsOrderStatus === "none"
      ) {
        initial[line.id] = true;
      }
    }
    setLaunchSelected(initial);
    setLaunchExpectedOn("");
    setLaunchChannel("manual");
    setLaunchInfo(null);
    setLaunchOpen(true);
  }

  async function confirmLaunchParts() {
    if (!activeQuote) return;
    const lineIds = Object.entries(launchSelected)
      .filter(([, on]) => on)
      .map(([id]) => id);
    if (!lineIds.length) {
      setError("Selectează cel puțin o linie de piese.");
      return;
    }
    setPending(true);
    setError(null);
    setLaunchInfo(null);
    try {
      const res = await fetch(
        `${workOrdersBrowserBase}/${workOrderId}/quotes/${activeQuote.id}/launch-parts-orders`,
        {
          method: "POST",
          headers: fleetJsonHeaders(),
          body: JSON.stringify({
            lineIds,
            expectedOn: launchExpectedOn || null,
            channel: launchChannel,
          }),
        },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        launched: number;
        channel: string;
        interCars?: { attempted: boolean; ok: boolean; message: string | null } | null;
      };
      const icNote =
        data.interCars?.attempted
          ? data.interCars.ok
            ? ` · IC OK${data.interCars.message ? `: ${data.interCars.message}` : ""}`
            : ` · IC eșuat${data.interCars.message ? `: ${data.interCars.message}` : ""} (status local setat)`
          : "";
      setLaunchInfo(`Lansate ${data.launched} linii (${data.channel})${icNote}`);
      setLaunchOpen(false);
      await load();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lansare comenzi eșuată");
    } finally {
      setPending(false);
    }
  }

  if (quotes === undefined) {
    return (
      <section className={sheetLayout ? "border-t border-zinc-800 p-4" : "mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"}>
        <p className="text-sm text-zinc-500">Se încarcă devizele…</p>
      </section>
    );
  }

  const sectionClass = sheetLayout
    ? "border-t-2 border-zinc-700 bg-zinc-950/40 p-4"
    : "mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4";

  return (
    <section className={sectionClass}>
      {sheetLayout ? (
        <div className="mb-4 flex flex-nowrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
          <span className="shrink-0 text-sm font-semibold text-zinc-200">Deviz</span>
          {activeQuote ? (
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${statusBadgeClass(activeQuote.status)}`}>
              Deviz {activeQuote.version} · {quoteStatusLabel(activeQuote.status)}
            </span>
          ) : (
            <span className="shrink-0 rounded-full border border-zinc-600 px-2 py-0.5 text-xs text-zinc-400">Ciornă</span>
          )}
          {canWrite && !draftQuote ? (
            <button
              type="button"
              onClick={startNewDraft}
              className={`${sheetBtnClass} border-emerald-600/50 bg-emerald-950/40 font-semibold text-emerald-100 hover:bg-emerald-950/60`}
              title="Creează Deviz următor (v2, v3…) pe aceeași comandă"
            >
              Deviz nou
            </button>
          ) : null}
          {canWrite && (isEditingDraft || quotes.length === 0 || isCreatingDraft) ? (
            <>
              <span className="h-5 w-px shrink-0 bg-zinc-700" />
              <button
                type="button"
                onClick={() => setLines([...lines, newLine(supplierDiscounts)])}
                className={`${sheetBtnClass} border-violet-500/50 bg-violet-950/40 font-semibold text-violet-100`}
              >
                + Linie
              </button>
              <button
                type="button"
                disabled={lines.length <= 1}
                onClick={() => setLines(lines.slice(0, -1))}
                className={`${sheetBtnClass} border-zinc-700 bg-zinc-900 text-zinc-200`}
              >
                Șterge linie
              </button>
            </>
          ) : null}
          <span className="min-w-2 flex-1" />
          {canWrite && allowQuotePdfImport ? (
            <button
              type="button"
              disabled={pending}
              title="Import PDF / Audatex → preview → ciornă"
              onClick={() => setImportOpen(true)}
              className={`${sheetBtnClass} border-violet-500/50 bg-violet-950/40 font-semibold text-violet-100`}
            >
              Import deviz PDF
            </button>
          ) : null}
          {canWrite && allowPartsPriceVerify ? (
            <button
              type="button"
              disabled={pending}
              title="Compară prețurile pieselor cu catalogul (stub până la API real)"
              onClick={() => void verifyPartsPrices()}
              className={`${sheetBtnClass} border-amber-500/50 bg-amber-950/40 font-semibold text-amber-100`}
            >
              Verifică preț
            </button>
          ) : null}
          {activeQuote && activeQuote.status !== "draft" ? (
            <a
              href={`${workOrdersBrowserBase}/${workOrderId}/quotes/${activeQuote.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${sheetBtnClass} border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800`}
            >
              Export PDF
            </a>
          ) : null}
        </div>
      ) : (
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
          {canWrite && allowQuotePdfImport ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => setImportOpen(true)}
              className="rounded-lg border border-violet-500/50 bg-violet-950/40 px-3 py-1.5 text-xs font-semibold text-violet-100"
            >
              Import PDF
            </button>
          ) : null}
          {canWrite && allowPartsPriceVerify ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => void verifyPartsPrices()}
              className="rounded-lg border border-amber-500/50 bg-amber-950/40 px-3 py-1.5 text-xs font-semibold text-amber-100"
            >
              Verifică preț
            </button>
          ) : null}
        </div>
      )}

      <QuoteImportModal
        workOrderId={workOrderId}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onApplied={() => {
          void load().then((data) => {
            const draft = data.find((q) => q.status === "draft");
            if (draft) {
              setActiveId(draft.id);
              setEditingDraftId(draft.id);
              setLines(linesFromQuote(draft));
              setNotes(draft.notes ?? "");
              setActiveTab("quote");
            }
          });
        }}
      />

      {launchOpen && activeQuote ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center">
          <div
            role="dialog"
            aria-modal
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950 p-4 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-zinc-100">Lansează comenzi piese</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Marchează liniile ca „Comandate” și setează WO pe waiting_parts. Opțional încearcă
                  rechiziție Inter Cars.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLaunchOpen(false)}
                className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300"
              >
                Închide
              </button>
            </div>

            <ul className="mt-4 max-h-48 space-y-2 overflow-y-auto text-sm">
              {activeQuote.lines
                .filter((l) => l.lineType === "parts" && l.approvalStatus !== "rejected")
                .map((line) => (
                  <li key={line.id}>
                    <label className="flex items-start gap-2 text-zinc-300">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={Boolean(launchSelected[line.id])}
                        disabled={line.partsOrderStatus !== "none"}
                        onChange={(e) =>
                          setLaunchSelected((s) => ({ ...s, [line.id]: e.target.checked }))
                        }
                      />
                      <span>
                        <span className="font-mono text-xs text-zinc-400">
                          {line.partNumber ?? "fără cod"}
                        </span>{" "}
                        · {line.description}
                        {line.partsOrderStatus !== "none" ? (
                          <span className="ml-1 text-xs text-zinc-500">
                            ({partsOrderLabels[line.partsOrderStatus]})
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                ))}
            </ul>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs text-zinc-400">
                Canal
                <select
                  className={OPS_INPUT_CLASS}
                  value={launchChannel}
                  onChange={(e) =>
                    setLaunchChannel(e.target.value as "intercars" | "manual")
                  }
                >
                  <option value="manual">Manual (doar status)</option>
                  <option value="intercars">Inter Cars (API + status)</option>
                </select>
              </label>
              <label className="space-y-1 text-xs text-zinc-400">
                Dată estimată livrare
                <input
                  type="date"
                  className={OPS_INPUT_CLASS}
                  value={launchExpectedOn}
                  onChange={(e) => setLaunchExpectedOn(e.target.value)}
                />
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLaunchOpen(false)}
                className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300"
              >
                Anulează
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => void confirmLaunchParts()}
                className="rounded border border-amber-500/50 bg-amber-950/40 px-3 py-1.5 text-xs font-semibold text-amber-100 disabled:opacity-50"
              >
                Confirmă lansarea
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex gap-2 border-b border-zinc-800">
        {[
          { id: "quote" as const, label: "Deviz" },
          { id: "warranty" as const, label: "Garanție" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`border-b-2 px-3 py-2 text-sm ${
              activeTab === tab.id
                ? "border-violet-500 text-violet-200"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

      {priceVerify ? (
        <div className="mt-3 rounded-lg border border-amber-800/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-100/90">
          <p>
            Verificare catalog
            {priceVerify.stubCatalog ? " (stub)" : ""}: {priceVerify.summary.ok} ok ·{" "}
            <span className={priceVerify.summary.suspect ? "font-semibold text-amber-200" : ""}>
              {priceVerify.summary.suspect} suspecte
            </span>
            {priceVerify.summary.noCode ? ` · ${priceVerify.summary.noCode} fără cod` : ""}
            {" · "}prag {priceVerify.suspectPercent}%
            {priceVerify.suspectPercentSource === "client" ? " (client)" : ""}
            {priceVerify.providersUsed.length
              ? ` · ${priceVerify.providersUsed.map((p) => p.label).join(", ")}`
              : ""}
          </p>
        </div>
      ) : null}

      {activeTab === "warranty" ? (
        <WorkOrderWarrantyPanel
          workOrderId={workOrderId}
          canWrite={canWrite}
          woStatus={workOrderStatus}
          outServiceAt={outServiceAt}
        />
      ) : null}

      {activeTab === "quote" && quotes.length > 0 ? (
        <div className="mt-4 border-b border-zinc-800">
          <div className="flex flex-wrap gap-2">
          {[...quotes]
            .sort((a, b) => a.version - b.version)
            .map((q) => {
              const selected = activeId === q.id;
              return (
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
                    if (q.invoiceAttachmentUrl) setInvoiceAttachmentUrl(q.invoiceAttachmentUrl);
                    setEditingDraftId(null);
                    setLineDecisions({});
                  }}
                  className={fleetSheetTabClass(selected)}
                  title={`${q.lines.length} linii · ${formatMoneyCents(q.totalGrossCents, q.currency)}`}
                >
                  Deviz {q.version}
                  <span className="ml-1.5 text-[11px] font-normal opacity-80">
                    {quoteStatusLabel(q.status)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {activeTab === "quote" && activeQuote && !isEditingDraft ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-4 text-sm">
            {(() => {
              const totals = quoteSubtotalsFromLines(activeQuote.lines, lineDecisions);
              return (
                <>
                  <span>
                    Total net:{" "}
                    <strong>
                      {formatMoneyCents(totals.labor + totals.parts + totals.other, activeQuote.currency)}
                    </strong>
                  </span>
                  <span>
                    TVA: <strong>{formatMoneyCents(totals.vat, activeQuote.currency)}</strong>
                  </span>
                  <span>
                    Total: <strong>{formatMoneyCents(totals.gross, activeQuote.currency)}</strong>
                  </span>
                  {totals.rejectedCount > 0 ? (
                    <span className="text-xs text-zinc-500">fără {totals.rejectedCount} respinse</span>
                  ) : null}
                </>
              );
            })()}
            {activeQuote.status !== "draft" ? (
              <a
                href={`${workOrdersBrowserBase}/${workOrderId}/quotes/${activeQuote.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 hover:underline"
              >
                PDF deviz
              </a>
            ) : null}
            {canWrite && activeQuote.status === "draft" ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => setEditingDraftId(activeQuote.id)}
                className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
              >
                Editează
              </button>
            ) : null}
            {activeQuote.lines.some((line) => line.partsOrderStatus === "ordered") ? (
              <span className="rounded-full border border-amber-700/50 bg-amber-950/30 px-2 py-0.5 text-xs text-amber-200">
                Comandă piese
              </span>
            ) : null}
            {canLaunchPartsOrders &&
            allowPartsOrderLaunch &&
            activeQuote.status === "approved" &&
            activeQuote.lines.some(
              (l) =>
                l.lineType === "parts" &&
                l.approvalStatus !== "rejected" &&
                l.partsOrderStatus === "none",
            ) ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => openLaunchParts()}
                className="rounded-lg border border-amber-500/50 bg-amber-950/40 px-2.5 py-1 text-xs font-semibold text-amber-100 hover:bg-amber-950/60 disabled:opacity-50"
              >
                Lansează comenzi piese
              </button>
            ) : null}
          </div>
          {launchInfo ? <p className="text-sm text-amber-200/90">{launchInfo}</p> : null}
          {activeQuote.rejectionReason ? (
            <p className="text-sm text-red-300">Motiv respingere: {activeQuote.rejectionReason}</p>
          ) : null}
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
                <th className="py-2 pr-2">Tip</th>
                <th className="py-2 pr-2">Descriere</th>
                <th className="py-2 pr-2">Cod</th>
                <th className="py-2 pr-2">Cant.</th>
                <th className="py-2 pr-2">Preț unit.</th>
                <th className="py-2 pr-2">Disc.</th>
                <th className="py-2 pr-2">TVA %</th>
                <th className="py-2 pr-2">Total net</th>
                <th className="py-2 pr-2">Aprobare</th>
                <th className="py-2">Piese</th>
              </tr>
            </thead>
            <tbody>
              {activeQuote.lines.map((line) => {
                const decision = lineDecisions[line.id];
                const displayedApproval = decision ?? line.approvalStatus;
                const rejected = displayedApproval === "rejected";
                const tint =
                  decision === "approved"
                    ? "bg-emerald-950/20"
                    : decision === "rejected"
                      ? "bg-red-950/20"
                      : line.approvalStatus === "approved"
                        ? "bg-emerald-950/10"
                        : line.approvalStatus === "rejected"
                          ? "bg-red-950/10"
                          : "";
                return (
                  <tr
                    key={line.id}
                    className={`border-b border-zinc-800/60 ${tint} ${rejected ? "text-zinc-500 line-through decoration-zinc-600" : ""}`}
                  >
                    <td className="py-2 pr-2 text-zinc-400">{quoteLineTypeLabel(line.lineType)}</td>
                    <td className="py-2 pr-2">{line.description}</td>
                    <td className="py-2 pr-2 font-mono text-xs text-zinc-300">
                      {line.partNumber ?? (line.partCodeExempt ? "fără cod" : "—")}
                    </td>
                    <td className="py-2 pr-2 font-mono">{line.quantity}</td>
                    <td className="py-2 pr-2 font-mono">
                      {formatMoneyCents(line.unitNetCents)}
                      {priceVerifyByKey[line.id] ? (
                        <PriceVerifyHint result={priceVerifyByKey[line.id]} canApply={false} />
                      ) : null}
                    </td>
                    <td className="py-2 pr-2 font-mono text-xs text-zinc-400">
                      {formatLineDiscount(line)}
                    </td>
                    <td className="py-2 pr-2">{line.vatRatePercent}%</td>
                    <td className="py-2 pr-2 font-mono">{formatMoneyCents(line.lineNetCents)}</td>
                    <td className="py-2 pr-2">
                      {canApprove && activeQuote.status === "submitted" ? (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => setLineDecisions((s) => ({ ...s, [line.id]: "approved" }))}
                            className={`rounded border px-2 py-0.5 text-xs ${
                              decision === "approved"
                                ? "border-emerald-500 bg-emerald-950/50 text-emerald-200"
                                : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                            }`}
                            aria-label="Aprobă linia"
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => setLineDecisions((s) => ({ ...s, [line.id]: "rejected" }))}
                            className={`rounded border px-2 py-0.5 text-xs ${
                              decision === "rejected"
                                ? "border-red-500 bg-red-950/50 text-red-200"
                                : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                            }`}
                            aria-label="Respinge linia"
                          >
                            ✗
                          </button>
                        </div>
                      ) : displayedApproval !== "pending" ? (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs ${
                            displayedApproval === "approved"
                              ? "border-emerald-700/50 text-emerald-200"
                              : "border-red-700/50 text-red-200"
                          }`}
                        >
                          {approvalLabels[displayedApproval]}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-500">—</span>
                      )}
                    </td>
                    <td className="py-2">
                      {line.lineType === "parts" ? (
                        activeQuote.status === "approved" && canWrite ? (
                          <div className="flex min-w-[260px] flex-wrap gap-2">
                            <select
                              value={line.partsOrderStatus}
                              disabled={pending}
                              onChange={(e) =>
                                void patchLineParts(line.id, {
                                  partsOrderStatus: e.target.value as QuotePartsOrderStatus,
                                })
                              }
                              className={`${OPS_INPUT_CLASS} w-32`}
                              aria-label="Comandă piese"
                            >
                              <option value="none">{partsOrderLabels.none}</option>
                              <option value="ordered">{partsOrderLabels.ordered}</option>
                              <option value="in_stock">{partsOrderLabels.in_stock}</option>
                              <option value="delivered">{partsOrderLabels.delivered}</option>
                            </select>
                            <input
                              type="date"
                              value={line.partsExpectedOn ? line.partsExpectedOn.slice(0, 10) : ""}
                              disabled={pending}
                              onChange={(e) =>
                                void patchLineParts(line.id, {
                                  partsExpectedOn: e.target.value || null,
                                })
                              }
                              className={`${OPS_INPUT_CLASS} w-36`}
                              aria-label="Data estimată piese"
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-400">
                            {partsOrderLabels[line.partsOrderStatus]}
                            {line.partsExpectedOn
                              ? ` · ${new Date(line.partsExpectedOn).toLocaleDateString("ro-RO")}`
                              : ""}
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-zinc-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-3 flex justify-end">
            <QuoteSubtotals
              {...quoteSubtotalsFromLines(activeQuote.lines, lineDecisions)}
              currency={activeQuote.currency}
            />
          </div>
          {canApprove && activeQuote.status === "submitted" ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setLineDecisions({});
                  void quoteAction("approve", {});
                }}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                Aprobă tot
              </button>
              <button
                type="button"
                disabled={pending || !hasLineDecisions}
                onClick={() => void approveSelection()}
                className="rounded-lg border border-emerald-500/50 px-3 py-1.5 text-sm text-emerald-200 hover:bg-emerald-950/40 disabled:opacity-50"
              >
                Aprobă selecția
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
              {isPartner && !activeQuote.invoicedAt ? (
                <p className="text-[11px] text-zinc-500">
                  Încarcă PDF-ul facturii și înregistrează numărul — fără acces la tichetul flotei.
                </p>
              ) : null}

              {activeQuote.invoicedAt ? (
                <p className="text-sm text-emerald-300">
                  Factură: {activeQuote.costInvoiceNumber ?? "—"}
                  {activeQuote.costInvoiceDate
                    ? ` · ${new Date(activeQuote.costInvoiceDate).toLocaleDateString("ro-RO")}`
                    : ""}
                  {activeQuote.invoiceAttachmentUrl ? (
                    <>
                      {" · "}
                      <a
                        href={activeQuote.invoiceAttachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-violet-300 hover:underline"
                      >
                        PDF factură
                      </a>
                    </>
                  ) : null}
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
                  Cost înregistrat
                  {!isPartner ? (
                    <>
                      {": "}
                      <Link href={`/fleet/costs/${activeQuote.costEntryId}`} className="text-sky-300 hover:underline">
                        deschide costul
                      </Link>
                    </>
                  ) : null}
                  {" · "}
                  {formatMoneyCents(activeQuote.totalGrossCents, activeQuote.currency)}
                </p>
              ) : activeQuote.invoicedAt && canWrite && canPostCost ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void postCost()}
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-500 disabled:opacity-50"
                >
                  Generează cost din deviz
                </button>
              ) : activeQuote.invoicedAt && isPartner && !activeQuote.costEntryId ? (
                <p className="text-sm text-zinc-500">Factura e înregistrată. Costul îl generează flota.</p>
              ) : !activeQuote.invoicedAt ? (
                <p className="text-sm text-zinc-500">Înregistrează factura înainte de cost.</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === "quote" && (isEditingDraft || quotes.length === 0 || isCreatingDraft) && canWrite ? (
        <div className="mt-4 space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
                  <th className="py-2 pr-2">Tip</th>
                  <th className="py-2 pr-2">Descriere</th>
                  <th className="py-2 pr-2">Cod piesă</th>
                  <th className="py-2 pr-2">Cant.</th>
                  <th className="py-2 pr-2">Preț net (lei)</th>
                  <th className="py-2 pr-2">Disc. %</th>
                  <th className="py-2 pr-2">Disc. lei</th>
                  <th className="py-2 pr-2">TVA %</th>
                  <th className="py-2 pr-2">Net</th>
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
                          const nextType = e.target.value as EditableLine["lineType"];
                          const next = [...lines];
                          const updated: EditableLine = { ...line, lineType: nextType };
                          if (!line.discountTouched) {
                            updated.discountPercent = formatDiscountPercentInput(
                              defaultDiscountForType(nextType, supplierDiscounts),
                            );
                            updated.discountLei = "";
                          }
                          next[idx] = updated;
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
                      <div className="space-y-1">
                        <input
                          value={line.partNumber}
                          disabled={line.partCodeExempt}
                          onChange={(e) => {
                            const next = [...lines];
                            next[idx] = { ...line, partNumber: e.target.value };
                            setLines(next);
                          }}
                          className={`${OPS_INPUT_CLASS} w-36 font-mono`}
                          placeholder={line.lineType === "parts" && requirePartCode ? "Obligatoriu" : "Opțional"}
                        />
                        <label className="flex items-center gap-1 text-[11px] text-zinc-500">
                          <input
                            type="checkbox"
                            checked={line.partCodeExempt}
                            onChange={(e) => {
                              const next = [...lines];
                              next[idx] = {
                                ...line,
                                partCodeExempt: e.target.checked,
                                partNumber: e.target.checked ? "" : line.partNumber,
                              };
                              setLines(next);
                            }}
                          />
                          fără cod
                        </label>
                      </div>
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
                      {priceVerifyByKey[line.key] ? (
                        <PriceVerifyHint
                          result={priceVerifyByKey[line.key]}
                          canApply={Boolean(isEditingDraft || isCreatingDraft)}
                          onApply={() => applyCatalogPrice(line.key)}
                        />
                      ) : null}
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        value={line.discountPercent}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = {
                            ...line,
                            discountPercent: e.target.value,
                            discountTouched: true,
                          };
                          setLines(next);
                        }}
                        className={`${OPS_INPUT_CLASS} w-16 font-mono`}
                        placeholder="0"
                        title="Dacă e > 0, are prioritate față de suma în lei"
                        aria-label="Discount procent"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        value={line.discountLei}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = {
                            ...line,
                            discountLei: e.target.value,
                            discountTouched: true,
                          };
                          setLines(next);
                        }}
                        className={`${OPS_INPUT_CLASS} w-24 font-mono`}
                        placeholder="0.00"
                        disabled={Boolean(parseFloat(line.discountPercent.replace(",", ".")))}
                        title="Sumă netă. Ignorată dacă completezi %."
                        aria-label="Discount lei"
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
                    <td className="py-2 pr-2 font-mono text-xs text-zinc-400">
                      {editableLineNetLabel(line)}
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
          {!sheetLayout ? (
            <button
              type="button"
              onClick={() => setLines([...lines, newLine(supplierDiscounts)])}
              className="text-xs text-sky-300 hover:underline"
            >
              + Linie
            </button>
          ) : null}
          <div>
            <label className={OPS_LABEL_CLASS}>Notițe deviz</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={OPS_INPUT_CLASS}
            />
          </div>
          {canWrite && draftQuote && !quoteLocked ? (
            <div className="rounded-lg border border-amber-800/40 bg-amber-950/20 p-3">
              <label className={OPS_LABEL_CLASS}>
                Estimare finalizare reparație <span className="text-amber-300">*</span>
              </label>
              <input
                type="date"
                value={estimatedDate}
                disabled={pending}
                onChange={(e) => setEstimatedDate(e.target.value)}
                onBlur={() => {
                  if (toIsoFromDateInput(estimatedDate)) void saveEstimatedRepair();
                }}
                className={`${OPS_INPUT_CLASS} max-w-xs`}
              />
              <p className="mt-1 text-xs text-zinc-500">
                Completată de partener — obligatorie înainte de „Trimite spre aprobare”. Vizibilă și pe tichet.
              </p>
            </div>
          ) : estimatedRepairAt ? (
            <p className="text-sm text-zinc-400">
              Estimare finalizare reparație:{" "}
              <span className="font-medium text-zinc-200">{formatDateRo(estimatedRepairAt)}</span>
            </p>
          ) : null}
          <div className="flex flex-wrap items-end justify-between gap-4">
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
                  disabled={pending || !hasEstimatedRepair}
                  title={!hasEstimatedRepair ? "Completați estimarea finalizării reparației" : undefined}
                  onClick={() => void quoteAction("submit")}
                  className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm text-white hover:bg-sky-500 disabled:opacity-50"
                >
                  Trimite spre aprobare
                </button>
              ) : null}
            </div>
            <QuoteSubtotals
              labor={previewTotals.labor}
              parts={previewTotals.parts}
              other={previewTotals.other}
              vat={previewTotals.vat}
              gross={previewTotals.gross}
            />
          </div>
        </div>
      ) : null}

      {activeTab === "quote" && !canWrite && quotes.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">Nu există devize pentru această comandă.</p>
      ) : null}
    </section>
  );
}

function PriceVerifyHint({
  result,
  canApply,
  onApply,
}: {
  result: PartsPriceVerifyLineResult;
  canApply: boolean;
  onApply?: () => void;
}) {
  if (result.status === "skipped") return null;

  const tone =
    result.status === "suspect"
      ? "text-amber-300"
      : result.status === "ok"
        ? "text-emerald-400/90"
        : "text-zinc-500";

  return (
    <div className={`mt-1 space-y-0.5 text-[10px] leading-snug ${tone}`}>
      <div title={result.message ?? undefined}>
        {result.status === "suspect"
          ? `Suspect +${result.deltaPercent}%`
          : result.status === "ok"
            ? result.deltaPercent != null && result.deltaPercent <= 0
              ? "≤ catalog"
              : "În prag"
            : result.status === "no_code"
              ? "Fără cod"
              : "Fără ofertă"}
        {result.bestUnitNetCents != null
          ? ` · cat. ${formatMoneyCents(result.bestUnitNetCents)}`
          : null}
      </div>
      {canApply && result.bestUnitNetCents != null && result.suspect ? (
        <button
          type="button"
          onClick={onApply}
          className="text-[10px] text-sky-300 underline hover:text-sky-200"
        >
          Aplică preț catalog
        </button>
      ) : null}
    </div>
  );
}
