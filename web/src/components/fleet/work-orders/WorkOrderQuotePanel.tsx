"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { OPS_INPUT_CLASS, OPS_LABEL_CLASS, fleetSheetTabClass } from "@/components/fleet/ops-form-primitives";
import { InvoiceAttachmentField } from "@/components/fleet/work-orders/InvoiceAttachmentField";
import { QuoteImportModal } from "@/components/fleet/work-orders/QuoteImportModal";
import { WorkOrderPhotoGallery } from "@/components/fleet/work-orders/WorkOrderPhotoGallery";
import { WorkOrderWarrantyPanel } from "@/components/fleet/work-orders/WorkOrderWarrantyPanel";
import { formatDateRo, toDateInput, toIsoFromDateInput } from "@/lib/datetime-local";
import {
  fleetJsonHeaders,
  formatMoneyCents,
  formatLineDiscount,
  computeQuoteLineMoney,
  quoteDisplayName,
  quoteLinesIncludedInTotals,
  workOrdersBrowserBase,
  type QuoteLineApprovalStatus,
  type QuoteLineInput,
  type QuotePartsOrderStatus,
  type PartsPriceVerifyLineResult,
  type VerifyPartsPricesResult,
  type WorkOrderQuoteParseStatus,
  type WorkOrderQuoteRecord,
  type WorkOrderQuoteStatus,
} from "@/lib/work-orders-api";
import type { WorkOrderSettings } from "@/lib/work-order-settings";
import {
  defaultLaborUnitLei,
  effectivePartsDiscountForBasis,
  type PartsPriceBasis,
} from "@/lib/supplier-rate-card";
import { supplierMenuLineTypeLabel, type SupplierMenuItemRecord } from "@/lib/suppliers-api";
import { useT } from "@/lib/i18n/useT";

type SupplierDiscountDefaults = {
  partsDiscountPercent: number;
  laborDiscountPercent: number;
  laborRateMechanicalCents?: number | null;
  laborRateBodyCents?: number | null;
  laborRatePaintCents?: number | null;
  laborRateDiagnosticCents?: number | null;
  partsPriceBasis?: PartsPriceBasis;
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
  if (lineType === "parts") {
    return effectivePartsDiscountForBasis(discounts.partsPriceBasis, discounts.partsDiscountPercent || 0);
  }
  if (lineType === "labor") return discounts.laborDiscountPercent || 0;
  return 0;
}

function newLine(
  discounts?: SupplierDiscountDefaults | null,
  lineType: QuoteLineInput["lineType"] = "parts",
): EditableLine {
  const unitNetLei = lineType === "labor" ? defaultLaborUnitLei(discounts) : "";
  return {
    key: Math.random().toString(36).slice(2),
    lineType,
    description: "",
    quantity: "1",
    unitNetLei,
    vatRatePercent: "21",
    discountPercent: formatDiscountPercentInput(defaultDiscountForType(lineType, discounts)),
    discountLei: "",
    discountTouched: false,
    partNumber: "",
    partCodeExempt: false,
  };
}

function lineFromMenuItem(
  item: SupplierMenuItemRecord,
  discounts?: SupplierDiscountDefaults | null,
): EditableLine {
  const lineType = item.lineType;
  return {
    key: Math.random().toString(36).slice(2),
    lineType,
    description: item.description?.trim() || item.label,
    quantity: "1",
    unitNetLei: centsToLei(item.unitNetCents),
    vatRatePercent: "21",
    discountPercent: formatDiscountPercentInput(defaultDiscountForType(lineType, discounts)),
    discountLei: "",
    discountTouched: false,
    partNumber: "",
    partCodeExempt: lineType === "parts",
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
  tx,
}: {
  labor: number;
  parts: number;
  other: number;
  vat: number;
  gross: number;
  rejectedCount?: number;
  currency?: string;
  tx: (key: string) => string;
}) {
  const net = labor + parts + other;
  const quoteT = (key: string) => tx(`workOrders.quote.${key}`);
  return (
    <div className="ml-auto w-full max-w-xs space-y-1 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm">
      <p className="pb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {quoteT("subtotals.title")}
      </p>
      <SubtotalRow label={quoteT("subtotals.labor")} cents={labor} currency={currency} />
      <SubtotalRow label={quoteT("subtotals.parts")} cents={parts} currency={currency} />
      <SubtotalRow label={quoteT("subtotals.other")} cents={other} currency={currency} />
      <div className="border-t border-zinc-800 pt-1">
        <SubtotalRow label={quoteT("subtotals.net")} cents={net} currency={currency} />
      </div>
      <SubtotalRow label={quoteT("subtotals.vat")} cents={vat} currency={currency} />
      <SubtotalRow label={quoteT("subtotals.gross")} cents={gross} currency={currency} bold />
      {rejectedCount > 0 ? (
        <p className="pt-1 text-[11px] text-zinc-500">
          {quoteT("subtotals.withoutRejected")
            .replace("{count}", String(rejectedCount))
            .replace(
              "{lines}",
              rejectedCount === 1 ? quoteT("subtotals.rejectedLineOne") : quoteT("subtotals.rejectedLineMany"),
            )}
        </p>
      ) : null}
    </div>
  );
}

function QuoteStatusStepper({ status, tx }: { status: WorkOrderQuoteStatus; tx: (key: string) => string }) {
  const steps: { id: WorkOrderQuoteStatus | "sent"; label: string }[] = [
    { id: "draft", label: tx("workOrders.quote.status.draft") },
    { id: "submitted", label: tx("workOrders.quote.status.sent") },
    { id: "approved", label: tx("workOrders.quote.status.approved") },
  ];
  const order: Record<string, number> = {
    draft: 0,
    submitted: 1,
    approved: 2,
    rejected: 1,
  };
  const current = order[status] ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
      {steps.map((s, i) => {
        const done = current > i || (status === "approved" && i <= 2);
        const active = status === s.id || (status === "rejected" && s.id === "submitted");
        return (
          <span key={s.id} className="inline-flex items-center gap-1.5">
            {i > 0 ? <span className="text-zinc-700">→</span> : null}
            <span
              className={`rounded border px-1.5 py-0.5 ${
                status === "rejected" && s.id === "submitted"
                  ? "border-red-500/50 bg-red-950/30 text-red-200"
                  : active
                    ? "border-sky-500/50 bg-sky-950/40 text-sky-100"
                    : done
                      ? "border-emerald-800/40 text-emerald-300/80"
                      : "border-zinc-800 text-zinc-600"
              }`}
            >
              {status === "rejected" && s.id === "submitted" ? tx("workOrders.quote.status.rejected") : s.label}
            </span>
          </span>
        );
      })}
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

function parseStatusBadgeClass(status: WorkOrderQuoteParseStatus | null | undefined): string {
  switch (status) {
    case "applied":
      return "border-emerald-600/50 bg-emerald-950/30 text-emerald-100";
    case "review":
      return "border-amber-600/50 bg-amber-950/30 text-amber-100";
    case "failed":
      return "border-red-600/50 bg-red-950/30 text-red-100";
    case "pending":
      return "border-zinc-600 bg-zinc-900 text-zinc-300";
    default:
      return "border-zinc-600 bg-zinc-900 text-zinc-300";
  }
}

type Props = {
  workOrderId: string;
  canWrite: boolean;
  canApprove?: boolean;
  /** Retrimite spre aprobare — partener sau tenant_admin (nu manager L1). */
  canResubmitQuote?: boolean;
  /** Mută Deviz pe altă Lucrare — partener sau admin cu write. */
  canMoveQuote?: boolean;
  /** Cost din factură — doar flotă (L* / L1). Partenerul încarcă factura, nu generează cost. */
  canPostCost?: boolean;
  /** Ascunde link-ul către /fleet/costs (portal partener). */
  isPartner?: boolean;
  sheetLayout?: boolean;
  /** Există Lucrare #2 pe WO. */
  hasLucrare2?: boolean;
  /** Track Lucrare activ (sincron cu Tila). */
  lucrareTrack?: 1 | 2;
  onLucrareTrackChange?: (track: 1 | 2) => void;
  /** Flux 2: deschide L2 după Lucrare gata pe L1. */
  canStartNewLucrare?: boolean;
  onStartNewLucrare?: () => void;
  estimatedRepairAt?: string | null;
  /** @deprecated Nu mai bloca tot panelul pe summary — estimarea e pe WO, draft-urile pe versiune. */
  quoteLocked?: boolean;
  workOrderStatus?: string;
  outServiceAt?: string | null;
  requirePartCode?: boolean;
  allowQuotePdfImport?: boolean;
  allowPartsPriceVerify?: boolean;
  allowPartsOrderLaunch?: boolean;
  /** Mod facturare din Setup WO. */
  quoteInvoiceMode?: WorkOrderSettings["quoteInvoiceMode"];
  /** Lansare comenzi: admin client/tenant sau partener (nu dispatcher). */
  canLaunchPartsOrders?: boolean;
  ticketSettlement?: {
    entityType: "maintenance" | "cost" | "document";
    entityId: string;
    createdAt: string;
  } | null;
  supplierDiscounts?: SupplierDiscountDefaults | null;
  supplierMenuItems?: SupplierMenuItemRecord[];
};

function quoteLucrareIndex(q: WorkOrderQuoteRecord): 1 | 2 {
  return q.lucrareIndex === 2 ? 2 : 1;
}

export function WorkOrderQuotePanel({
  workOrderId,
  canWrite,
  canApprove = false,
  canResubmitQuote = false,
  canMoveQuote = false,
  canPostCost = true,
  sheetLayout = false,
  hasLucrare2 = false,
  lucrareTrack = 1,
  onLucrareTrackChange,
  canStartNewLucrare = false,
  onStartNewLucrare,
  estimatedRepairAt = null,
  quoteLocked: _quoteLocked = false,
  workOrderStatus = "",
  outServiceAt = null,
  requirePartCode = true,
  allowQuotePdfImport = true,
  allowPartsPriceVerify = true,
  allowPartsOrderLaunch = false,
  quoteInvoiceMode = "per_quote",
  canLaunchPartsOrders = false,
  ticketSettlement = null,
  isPartner = false,
  supplierDiscounts = null,
  supplierMenuItems = [],
}: Props) {
  const tx = useT();
  const quoteT = (key: string) => tx(`workOrders.quote.${key}`);
  const formatMsg = (key: string, values: Record<string, string | number>) => {
    let text = quoteT(key);
    for (const [name, value] of Object.entries(values)) {
      text = text.replace(`{${name}}`, String(value));
    }
    return text;
  };
  const quoteStatus = (status: WorkOrderQuoteStatus | string) => {
    const key = `workOrders.quote.status.${status}`;
    const translated = tx(key);
    return translated === key ? status : translated;
  };
  const quoteParseStatus = (status: WorkOrderQuoteParseStatus | string) => {
    const key = `workOrders.quote.parseStatus.${status}`;
    const translated = tx(key);
    return translated === key ? status : translated;
  };
  const quoteLineType = (lineType: QuoteLineInput["lineType"] | string) => {
    const key = `workOrders.quote.lineTypes.${lineType}`;
    const translated = tx(key);
    return translated === key ? lineType : translated;
  };
  const partsOrderLabel = (status: QuotePartsOrderStatus) => quoteT(`partsOrder.${status}`);
  const approvalLabel = (status: QuoteLineApprovalStatus) => quoteT(`approvalStatus.${status}`);
  const router = useRouter();
  const [quotes, setQuotes] = useState<WorkOrderQuoteRecord[] | undefined>(undefined);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"quote" | "warranty">("quote");
  /** Pe versiunea de deviz: linii / poze; sau tab consolidat pe toate aprobările. */
  const [quotePane, setQuotePane] = useState<"lines" | "photos" | "consol">("lines");
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [lines, setLines] = useState<EditableLine[]>(() => [newLine(supplierDiscounts)]);
  const [notes, setNotes] = useState("");
  const [title, setTitle] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [invoiceGross, setInvoiceGross] = useState("");
  const [invoiceAttachmentUrl, setInvoiceAttachmentUrl] = useState("");
  const [lineDecisions, setLineDecisions] = useState<Record<string, QuoteLineApprovalStatus | undefined>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [launchOpen, setLaunchOpen] = useState(false);
  const [launchExpectedOn, setLaunchExpectedOn] = useState("");
  const [launchChannel, setLaunchChannel] = useState<"intercars" | "manual">("manual");
  const [launchSelected, setLaunchSelected] = useState<Record<string, boolean>>({});
  const [launchInfo, setLaunchInfo] = useState<string | null>(null);
  const [priceVerify, setPriceVerify] = useState<VerifyPartsPricesResult | null>(null);
  const [priceVerifyByKey, setPriceVerifyByKey] = useState<Record<string, PartsPriceVerifyLineResult>>({});
  const [estimatedDate, setEstimatedDate] = useState(() => toDateInput(estimatedRepairAt));
  /** true când userul a apăsat Deviz nou (ciornă locală, încă nesalvată). */
  const [creatingNew, setCreatingNew] = useState(false);
  /** Panel inline „Mută Devizul” (fără window.prompt). */
  const [movePickerOpen, setMovePickerOpen] = useState(false);
  const activeMenuItems = useMemo(
    () => supplierMenuItems.filter((item) => item.active),
    [supplierMenuItems],
  );
  const [selectedMenuItemId, setSelectedMenuItemId] = useState("");

  useEffect(() => {
    setEstimatedDate(toDateInput(estimatedRepairAt));
  }, [estimatedRepairAt]);

  const hasEstimatedRepair = Boolean(estimatedRepairAt || toIsoFromDateInput(estimatedDate));

  const saveEstimatedRepair = useCallback(async (): Promise<boolean> => {
    const iso = toIsoFromDateInput(estimatedDate);
    if (!iso) {
      setError(quoteT("errors.estimatedRepairRequired"));
      return false;
    }
    // Deja setată pe WO (ex. la Deviz 1) — nu mai PATCH; altfel API blochează după quote submitted.
    if (estimatedRepairAt && toDateInput(estimatedRepairAt) === estimatedDate) return true;
    if (estimatedRepairAt) {
      // Altă zi decât cea salvată: după Deviz 1 trimis/aprobat API refuză schimbarea.
      setError(quoteT("errors.estimatedRepairLocked"));
      return false;
    }
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
      setError(e instanceof Error ? e.message : quoteT("errors.saveEstimateFailed"));
      return false;
    } finally {
      setPending(false);
    }
  }, [estimatedDate, estimatedRepairAt, workOrderId, router]);

  const load = useCallback(async (preferId?: string | null) => {
    try {
      const res = await fetch(`${workOrdersBrowserBase}/${workOrderId}/quotes`);
      if (!res.ok) {
        setQuotes([]);
        return [] as WorkOrderQuoteRecord[];
      }
      const data = (await res.json()) as WorkOrderQuoteRecord[];
      setQuotes(data);
      const preferred = preferId ? data.find((q) => q.id === preferId) : null;
      const draft = data.find((q) => q.status === "draft");
      const selected = preferred ?? draft ?? data[0] ?? null;
      setActiveId(selected?.id ?? null);
      setEditingDraftId((current) =>
        current && data.some((q) => q.id === current && q.status === "draft") ? current : null,
      );
      setLineDecisions({});
      if (selected?.status === "draft") {
        setLines(linesFromQuote(selected));
        setNotes(selected.notes ?? "");
        setTitle(selected.title ?? "");
      } else if (selected) {
        setTitle(selected.title ?? "");
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

  const trackQuotes = useMemo(() => {
    if (!quotes?.length) return [] as WorkOrderQuoteRecord[];
    if (!hasLucrare2) return quotes;
    return quotes.filter((q) => quoteLucrareIndex(q) === lucrareTrack);
  }, [quotes, hasLucrare2, lucrareTrack]);

  useEffect(() => {
    if (!quotes?.length) return;
    if (!hasLucrare2) return;
    if (creatingNew) return;
    const onTrack = activeId ? quotes.find((q) => q.id === activeId && quoteLucrareIndex(q) === lucrareTrack) : null;
    if (onTrack) return;
    const draft = trackQuotes.find((q) => q.status === "draft");
    const next = draft ?? trackQuotes[0] ?? null;
    setActiveId(next?.id ?? null);
    if (next) setTitle(next.title ?? "");
    if (quotePane === "consol" && trackQuotes.filter((q) => q.status === "approved").length < 2) {
      setQuotePane("lines");
    }
  }, [lucrareTrack, hasLucrare2, quotes, activeId, trackQuotes, quotePane, creatingNew]);

  const draftQuote = trackQuotes.find((q) => q.status === "draft") ?? null;
  const isEditingDraft = activeQuote?.status === "draft" && editingDraftId === activeQuote.id;
  const isCreatingDraft = creatingNew || (!activeQuote && canWrite && trackQuotes.length === 0);
  const hasLineDecisions = Object.values(lineDecisions).some(Boolean);

  const consolidatedLines = useMemo(() => {
    if (!trackQuotes.length) return [];
    const rows: Array<{
      quoteId: string;
      quoteLabel: string;
      version: number;
      line: WorkOrderQuoteRecord["lines"][number];
    }> = [];
    for (const q of [...trackQuotes].sort((a, b) => a.version - b.version)) {
      if (q.status !== "approved") continue;
      for (const line of q.lines) {
        if (line.approvalStatus === "rejected") continue;
        rows.push({
          quoteId: q.id,
          quoteLabel: quoteDisplayName(q),
          version: q.version,
          line,
        });
      }
    }
    return rows;
  }, [trackQuotes]);

  const showConsolidated = trackQuotes.filter((q) => q.status === "approved").length >= 2;

  const consolidatedTotals = useMemo(() => {
    let net = 0;
    let vat = 0;
    for (const row of consolidatedLines) {
      net += row.line.lineNetCents;
      vat += row.line.lineVatCents;
    }
    return { net, vat, gross: net + vat };
  }, [consolidatedLines]);

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
      const payload = {
        lines: toPayload(lines),
        notes: notes || null,
        title: title.trim() || null,
      };
      for (const line of payload.lines) {
        if (!line.description?.trim()) {
          setError(quoteT("errors.descriptionRequired"));
          return;
        }
        if (requirePartCode && line.lineType === "parts" && !line.partCodeExempt && !line.partNumber?.trim()) {
          setError(quoteT("errors.partCodeRequired"));
          return;
        }
        if (!Number.isFinite(line.unitNetCents) || line.unitNetCents < 0) {
          setError(quoteT("errors.invalidUnitPrice"));
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
      setCreatingNew(false);
    } finally {
      setPending(false);
    }
  }

  async function postCost() {
    if (!activeQuote) return;
    if (ticketSettlement) {
      const kind =
        ticketSettlement.entityType === "maintenance"
          ? quoteT("labels.maintenance")
          : ticketSettlement.entityType === "cost"
            ? quoteT("labels.cost")
            : quoteT("labels.document");
      const date = new Date(ticketSettlement.createdAt).toLocaleDateString("ro-RO");
      const ok = window.confirm(formatMsg("confirm.generateCostAgain", { kind, date }));
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
            invoiceGrossCents: invoiceGross.trim()
              ? Math.round(parseFloat(invoiceGross.replace(",", ".")) * 100)
              : null,
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
    const submittedId = activeQuote.id;
    if (action === "submit") {
      // Submit cere estimatedRepairAt pe WO; dacă există deja (Deviz 1), nu o mai rescriem.
      if (estimatedRepairAt) {
        /* ok — quote submit API verifică câmpul pe WO */
      } else {
        const okEst = await saveEstimatedRepair();
        if (!okEst) return;
      }
    }
    setPending(true);
    setError(null);
    setOk(null);
    try {
      let body: string | undefined;
      if (action === "reject") {
        const reason = window.prompt(quoteT("prompts.rejectReason")) ?? "";
        body = JSON.stringify({ reason });
      } else if (action === "approve" && approveBody) {
        body = JSON.stringify(approveBody);
      }
      const res = await fetch(
        `${workOrdersBrowserBase}/${workOrderId}/quotes/${submittedId}/${action}`,
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
      setEditingDraftId(null);
      await load(submittedId);
      setQuotePane("lines");
      if (action === "submit") {
        setOk(quoteT("messages.sent"));
      } else if (action === "approve") {
        setOk(quoteT("messages.approved"));
      } else {
        setOk(quoteT("messages.rejected"));
      }
      setLineDecisions({});
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function resubmitForApproval() {
    if (!activeQuote || activeQuote.status !== "submitted") return;
    const submittedId = activeQuote.id;
    const iso = toIsoFromDateInput(estimatedDate);
    if (!iso) {
      setError(quoteT("errors.chooseNewEstimateBeforeResubmit"));
      return;
    }
    const estLabel = formatDateRo(iso);
    if (!window.confirm(formatMsg("confirm.resubmit", { date: estLabel }))) {
      return;
    }
    setPending(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(
        `${workOrdersBrowserBase}/${workOrderId}/quotes/${submittedId}/resubmit`,
        {
          method: "POST",
          headers: fleetJsonHeaders(),
          body: JSON.stringify({ estimatedRepairAt: iso }),
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
      const data = (await res.json()) as { estimatedRepairAt?: string };
      await load(submittedId);
      setQuotePane("lines");
      setLineDecisions({});
      const nextLabel = data.estimatedRepairAt ? formatDateRo(data.estimatedRepairAt) : estLabel;
      setOk(formatMsg("messages.resubmitted", { date: nextLabel }));
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function moveQuoteToLucrare(target: 1 | 2) {
    if (!activeQuote || !canMoveQuote || !hasLucrare2) return;
    const current = quoteLucrareIndex(activeQuote);
    if (target === current) {
      setOk(formatMsg("messages.quoteAlreadyOnTrack", { track: target }));
      setMovePickerOpen(false);
      return;
    }
    setPending(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(
        `${workOrdersBrowserBase}/${workOrderId}/quotes/${activeQuote.id}/move-lucrare`,
        {
          method: "POST",
          headers: fleetJsonHeaders(),
          body: JSON.stringify({ lucrareIndex: target }),
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
      setMovePickerOpen(false);
      await load(activeQuote.id);
      onLucrareTrackChange?.(target);
      setOk(formatMsg("messages.quoteMoved", { track: target }));
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function deleteDraft() {
    if (!activeQuote || activeQuote.status !== "draft") return;
    if (!window.confirm(formatMsg("confirm.deleteDraft", { quote: quoteDisplayName(activeQuote) }))) {
      return;
    }
    setPending(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`${workOrdersBrowserBase}/${workOrderId}/quotes/${activeQuote.id}`, {
        method: "DELETE",
        headers: fleetJsonHeaders(),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (Array.isArray(j.message)) msg = j.message.join(", ");
          else if (j.message) msg = j.message;
        } catch {
          /* ignore */
        }
        setError(msg);
        return;
      }
      setMovePickerOpen(false);
      setCreatingNew(false);
      setEditingDraftId(null);
      await load();
      setOk(quoteT("messages.deletedDraft"));
    } finally {
      setPending(false);
    }
  }

  async function saveQuoteTitle(quoteId: string, nextTitle: string) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${workOrdersBrowserBase}/${workOrderId}/quotes/${quoteId}`, {
        method: "PATCH",
        headers: fleetJsonHeaders(),
        body: JSON.stringify({ title: nextTitle.trim() || null }),
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

  async function approveSelection() {
    if (!activeQuote) return;
    const decisions = activeQuote.lines.map((line) => ({ lineId: line.id, status: lineDecisions[line.id] }));
    if (decisions.some((line) => !line.status)) {
      setError(quoteT("errors.chooseLineDecision"));
      return;
    }
    if (!decisions.some((line) => line.status === "approved")) {
      setError(quoteT("errors.selectApprovedLine"));
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
      setError(e instanceof Error ? e.message : quoteT("errors.updatePartsFailed"));
    } finally {
      setPending(false);
    }
  }

  function startNewDraft() {
    const anyDraft = quotes?.find((q) => q.status === "draft");
    if (anyDraft) {
      const track = quoteLucrareIndex(anyDraft);
      setCreatingNew(false);
      if (hasLucrare2 && track !== lucrareTrack) {
        onLucrareTrackChange?.(track);
      }
      setActiveId(anyDraft.id);
      setEditingDraftId(anyDraft.id);
      setLines(linesFromQuote(anyDraft));
      setNotes(anyDraft.notes ?? "");
      setTitle(anyDraft.title ?? "");
      setQuotePane("lines");
      setActiveTab("quote");
      setError(null);
      setOk(
        hasLucrare2 && track !== lucrareTrack
          ? formatMsg("messages.draftExistsOnTrack", { track })
          : quoteT("messages.draftExists"),
      );
      return;
    }
    setCreatingNew(true);
    setActiveId(null);
    setEditingDraftId(null);
    setLines([newLine(supplierDiscounts)]);
    setNotes("");
    setTitle("");
    setPriceVerify(null);
    setPriceVerifyByKey({});
    setQuotePane("lines");
    setActiveTab("quote");
    setError(null);
    setOk(formatMsg("messages.newDraft", { target: hasLucrare2 ? `L${lucrareTrack}` : quoteT("labels.order") }));
  }

  function addMenuLine() {
    const item = activeMenuItems.find((m) => m.id === selectedMenuItemId) ?? activeMenuItems[0];
    if (!item) return;
    setLines((prev) => [...prev, lineFromMenuItem(item, supplierDiscounts)]);
    setSelectedMenuItemId("");
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
      setError(quoteT("errors.noPartsLines"));
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
      setError(e instanceof Error ? e.message : quoteT("errors.priceVerifyFailed"));
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
      setError(quoteT("errors.choosePartsLine"));
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
      setError(e instanceof Error ? e.message : quoteT("errors.launchFailed"));
    } finally {
      setPending(false);
    }
  }

  if (quotes === undefined) {
    return (
      <section className={sheetLayout ? "border-t border-zinc-800 p-4" : "mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"}>
        <p className="text-sm text-zinc-500">{quoteT("messages.loading")}</p>
      </section>
    );
  }

  const sectionClass = sheetLayout
    ? "border-t-2 border-zinc-700 bg-zinc-950/40 p-4"
    : "mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4";

  return (
    <section className={sectionClass}>
      {sheetLayout ? (
        <div className="mb-4 space-y-2">
          <div className="flex flex-nowrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              {quoteT("labels.work")}
            </span>
            <span className="shrink-0 text-sm font-semibold text-zinc-200">
              {hasLucrare2 ? `L${lucrareTrack}` : "L1"}
            </span>
            {canStartNewLucrare && onStartNewLucrare ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => onStartNewLucrare()}
                className={`${sheetBtnClass} border-amber-600/50 bg-amber-950/40 font-semibold text-amber-100 hover:bg-amber-950/60`}
                title={quoteT("tooltips.newWork")}
              >
                {quoteT("actions.newWork")}
              </button>
            ) : null}
            <span className="min-w-2 flex-1" />
          </div>
          <div className="flex flex-nowrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              {quoteT("labels.quote")}
            </span>
            {activeQuote ? (
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${statusBadgeClass(activeQuote.status)}`}>
                  v{activeQuote.version} · {quoteStatus(activeQuote.status)}
                  {activeQuote.title ? ` · ${activeQuote.title}` : ""}
                </span>
                <QuoteStatusStepper status={activeQuote.status} tx={tx} />
                {activeQuote.sourcePdfUrl ? (
                  <>
                    {activeQuote.parseStatus ? (
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${parseStatusBadgeClass(activeQuote.parseStatus)}`}
                      >
                        {quoteParseStatus(activeQuote.parseStatus)}
                      </span>
                    ) : null}
                    <a
                      href={activeQuote.sourcePdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-[10px] text-sky-400 underline-offset-2 hover:underline"
                    >
                      {quoteT("labels.sourcePdf")}
                    </a>
                  </>
                ) : null}
              </div>
            ) : isCreatingDraft ? (
              <span className="shrink-0 rounded-full border border-emerald-700/50 px-2 py-0.5 text-xs text-emerald-200">
                {quoteT("labels.draftNew")}
              </span>
            ) : (
              <span className="shrink-0 rounded-full border border-zinc-600 px-2 py-0.5 text-xs text-zinc-400">
                —
              </span>
            )}
            {canWrite ? (
              <button
                type="button"
                disabled={pending}
                onClick={startNewDraft}
                className={`${sheetBtnClass} border-emerald-600/50 bg-emerald-950/40 font-semibold text-emerald-100 hover:bg-emerald-950/60`}
                title={quoteT("tooltips.newQuote")}
              >
                {quoteT("actions.newQuote")}
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
                  {quoteT("actions.addLine")}
                </button>
                <button
                  type="button"
                  disabled={lines.length <= 1}
                  onClick={() => setLines(lines.slice(0, -1))}
                  className={`${sheetBtnClass} border-zinc-700 bg-zinc-900 text-zinc-200`}
                >
                  {quoteT("actions.deleteLine")}
                </button>
              </>
            ) : null}
            <span className="min-w-2 flex-1" />
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-zinc-200">{quoteT("labels.quote")}</h2>
            <p className="mt-1 text-xs text-zinc-500">{quoteT("descriptions.quote")}</p>
          </div>
          {canWrite ? (
            <button
              type="button"
              onClick={startNewDraft}
              className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
            >
              {quoteT("actions.newQuote")}
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
                <h2 className="text-base font-semibold text-zinc-100">{quoteT("actions.launchParts")}</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  {quoteT("descriptions.launchParts")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLaunchOpen(false)}
                className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300"
              >
                {quoteT("actions.close")}
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
                          {line.partNumber ?? quoteT("labels.partNumberMissing")}
                        </span>{" "}
                        · {line.description}
                        {line.partsOrderStatus !== "none" ? (
                          <span className="ml-1 text-xs text-zinc-500">
                            ({partsOrderLabel(line.partsOrderStatus)})
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                ))}
            </ul>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs text-zinc-400">
                {quoteT("fields.channel")}
                <select
                  className={OPS_INPUT_CLASS}
                  value={launchChannel}
                  onChange={(e) =>
                    setLaunchChannel(e.target.value as "intercars" | "manual")
                  }
                >
                  <option value="manual">{quoteT("options.manualStatus")}</option>
                  <option value="intercars">Inter Cars (API + status)</option>
                </select>
              </label>
              <label className="space-y-1 text-xs text-zinc-400">
                {quoteT("fields.estimatedDeliveryDate")}
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
                {quoteT("actions.cancel")}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => void confirmLaunchParts()}
                className="rounded border border-amber-500/50 bg-amber-950/40 px-3 py-1.5 text-xs font-semibold text-amber-100 disabled:opacity-50"
              >
                {quoteT("actions.confirmLaunch")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex gap-2 border-b border-zinc-800">
        {(hasLucrare2
          ? [
              { id: "l1" as const, label: `${quoteT("labels.work")} 1` },
              { id: "l2" as const, label: `${quoteT("labels.work")} 2` },
              { id: "warranty" as const, label: quoteT("labels.warranty") },
            ]
          : [
              { id: "quote" as const, label: quoteT("labels.quote") },
              { id: "warranty" as const, label: quoteT("labels.warranty") },
            ]
        ).map((tab) => {
          const selected =
            tab.id === "warranty"
              ? activeTab === "warranty"
              : activeTab === "quote" &&
                (tab.id === "quote" ||
                  (tab.id === "l1" && lucrareTrack === 1) ||
                  (tab.id === "l2" && lucrareTrack === 2));
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                if (tab.id === "warranty") {
                  setActiveTab("warranty");
                  return;
                }
                setActiveTab("quote");
                setQuotePane("lines");
                if (tab.id === "l1") onLucrareTrackChange?.(1);
                if (tab.id === "l2") onLucrareTrackChange?.(2);
              }}
              className={`border-b-2 px-3 py-2 text-sm ${
                selected
                  ? "border-violet-500 text-violet-200"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {ok ? <p className="mt-3 text-sm text-emerald-400">{ok}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

      {priceVerify ? (
        <div className="mt-3 rounded-lg border border-amber-800/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-100/90">
          <p>
            {quoteT("labels.catalogCheck")}
            {priceVerify.stubCatalog ? " (stub)" : ""}: {priceVerify.summary.ok} ok ·{" "}
            <span className={priceVerify.summary.suspect ? "font-semibold text-amber-200" : ""}>
              {priceVerify.summary.suspect} suspecte
            </span>
            {priceVerify.summary.noCode ? ` · ${priceVerify.summary.noCode} ${quoteT("labels.noCode")}` : ""}
            {" · "}{quoteT("labels.threshold")} {priceVerify.suspectPercent}%
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

      {activeTab === "quote" && trackQuotes.length === 0 && !isCreatingDraft ? (
        <p className="mt-4 text-sm text-zinc-500">
          {hasLucrare2
            ? formatMsg("empty.noTrackQuotes", { track: lucrareTrack })
            : quoteT("empty.noQuotes")}
        </p>
      ) : null}

      {activeTab === "quote" && trackQuotes.length > 0 ? (
        <div className="mt-4 border-b border-zinc-800">
          <div className="flex flex-wrap gap-2">
            {showConsolidated ? (
              <button
                type="button"
                onClick={() => {
                  setQuotePane("consol");
                  setEditingDraftId(null);
                }}
                className={fleetSheetTabClass(quotePane === "consol")}
                title={quoteT("tooltips.consolidated")}
              >
                {quoteT("labels.consolidated")}
                <span className="ml-1.5 text-[11px] font-normal opacity-80">
                  {consolidatedLines.length} {quoteT("labels.lineShort")}
                </span>
              </button>
            ) : null}
            {[...trackQuotes]
              .sort((a, b) => a.version - b.version)
              .flatMap((q) => {
                const linesSelected = activeId === q.id && quotePane === "lines";
                const photosSelected = activeId === q.id && quotePane === "photos";
                const selectQuote = () => {
                  setCreatingNew(false);
                  setMovePickerOpen(false);
                  setActiveId(q.id);
                  setTitle(q.title ?? "");
                  if (q.status === "draft") {
                    setLines(linesFromQuote(q));
                    setNotes(q.notes ?? "");
                  }
                  if (q.costInvoiceNumber) setInvoiceNumber(q.costInvoiceNumber);
                  if (q.costInvoiceDate) setInvoiceDate(q.costInvoiceDate.slice(0, 10));
                  if (q.invoiceAttachmentUrl) setInvoiceAttachmentUrl(q.invoiceAttachmentUrl);
                  setEditingDraftId(null);
                  setLineDecisions({});
                };
                return [
                  <button
                    key={`${q.id}-lines`}
                    type="button"
                    onClick={() => {
                      selectQuote();
                      setQuotePane("lines");
                    }}
                    className={fleetSheetTabClass(linesSelected)}
                    title={`${q.lines.length} ${quoteT("labels.lines")} · ${formatMoneyCents(q.totalGrossCents, q.currency)}`}
                  >
                    {quoteDisplayName(q)}
                    <span className="ml-1.5 text-[11px] font-normal opacity-80">
                      {quoteStatus(q.status)}
                    </span>
                  </button>,
                  <button
                    key={`${q.id}-photos`}
                    type="button"
                    onClick={() => {
                      selectQuote();
                      setQuotePane("photos");
                    }}
                    className={fleetSheetTabClass(photosSelected)}
                    title={`${quoteT("labels.photos")} ${quoteDisplayName(q)}`}
                  >
                    {quoteT("labels.photos")} {q.version}
                  </button>,
                ];
              })}
          </div>
        </div>
      ) : null}

      {activeTab === "quote" && quotePane === "consol" && showConsolidated ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-4 text-sm">
            <span>
              {quoteT("labels.totalNetApproved")}:{" "}
              <strong>{formatMoneyCents(consolidatedTotals.net)}</strong>
            </span>
            <span>
              {quoteT("labels.vat")}: <strong>{formatMoneyCents(consolidatedTotals.vat)}</strong>
            </span>
            <span>
              {quoteT("labels.total")}: <strong>{formatMoneyCents(consolidatedTotals.gross)}</strong>
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            {quoteInvoiceMode === "per_work_order"
              ? quoteT("messages.invoiceModePerWorkOrder")
              : quoteT("messages.invoiceModePerQuote")}
          </p>
          {consolidatedLines.length === 0 ? (
            <p className="text-sm text-zinc-500">{quoteT("empty.noApprovedLines")}</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
                  <th className="py-2 pr-2">{quoteT("labels.quote")}</th>
                  <th className="py-2 pr-2">{quoteT("fields.type")}</th>
                  <th className="py-2 pr-2">{quoteT("fields.description")}</th>
                  <th className="py-2 pr-2">{quoteT("fields.partCode")}</th>
                  <th className="py-2 pr-2">{quoteT("fields.quantity")}</th>
                  <th className="py-2 pr-2">{quoteT("labels.totalNet")}</th>
                </tr>
              </thead>
              <tbody>
                {consolidatedLines.map((row) => (
                  <tr key={`${row.quoteId}-${row.line.id}`} className="border-b border-zinc-800/60">
                    <td className="py-2 pr-2 text-xs text-zinc-400">
                      <button
                        type="button"
                        className="text-sky-400 hover:underline"
                        onClick={() => {
                          setActiveId(row.quoteId);
                          setQuotePane("lines");
                        }}
                      >
                        {row.quoteLabel}
                      </button>
                    </td>
                    <td className="py-2 pr-2">{quoteLineType(row.line.lineType)}</td>
                    <td className="py-2 pr-2">{row.line.description}</td>
                    <td className="py-2 pr-2 font-mono text-xs">{row.line.partNumber ?? "—"}</td>
                    <td className="py-2 pr-2">{row.line.quantity}</td>
                    <td className="py-2 pr-2 font-mono text-xs">
                      {formatMoneyCents(row.line.lineNetCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}

      {activeTab === "quote" && quotePane === "photos" && activeQuote ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs text-zinc-500">
            {formatMsg("descriptions.photos", { quote: quoteDisplayName(activeQuote) })}
          </p>
          <WorkOrderPhotoGallery
            workOrderId={workOrderId}
            canWrite={canWrite}
            mode="quote"
            quoteId={activeQuote.id}
          />
        </div>
      ) : null}

      {activeTab === "quote" && quotePane === "lines" && activeQuote && !isEditingDraft ? (
        <div className="mt-4 space-y-3">
          {canWrite ? (
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-[12rem] flex-1 space-y-1">
                <span className={OPS_LABEL_CLASS}>{quoteT("fields.title")}</span>
                <input
                  type="text"
                  value={title}
                  disabled={pending}
                  placeholder={`${quoteT("labels.quote")} ${activeQuote.version}`}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => {
                    const next = title.trim();
                    const prev = (activeQuote.title ?? "").trim();
                    if (next !== prev) void saveQuoteTitle(activeQuote.id, next);
                  }}
                  className={`${OPS_INPUT_CLASS} max-w-sm`}
                />
              </label>
            </div>
          ) : activeQuote.title ? (
            <p className="text-sm text-zinc-300">{activeQuote.title}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
            {canWrite && allowQuotePdfImport ? (
              <button
                type="button"
                disabled={pending}
                title={quoteT("tooltips.importPdf")}
                onClick={() => setImportOpen(true)}
                className="rounded-lg border border-violet-500/50 bg-violet-950/40 px-2.5 py-1 text-xs font-semibold text-violet-100 hover:bg-violet-950/60 disabled:opacity-50"
              >
                {quoteT("actions.importPdf")}
              </button>
            ) : null}
            {canWrite && allowPartsPriceVerify ? (
              <button
                type="button"
                disabled={pending}
                title={quoteT("tooltips.verifyPrice")}
                onClick={() => void verifyPartsPrices()}
                className="rounded-lg border border-amber-500/50 bg-amber-950/40 px-2.5 py-1 text-xs font-semibold text-amber-100 hover:bg-amber-950/60 disabled:opacity-50"
              >
                {quoteT("actions.verifyPrice")}
              </button>
            ) : null}
            {activeQuote.status !== "draft" ? (
              <a
                href={`${workOrdersBrowserBase}/${workOrderId}/quotes/${activeQuote.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
              >
                {quoteT("actions.exportPdf")}
              </a>
            ) : null}
            <span className="min-w-2 flex-1" />
            <span className="text-sm text-zinc-300">
              {(() => {
                const totals = quoteSubtotalsFromLines(activeQuote.lines, lineDecisions);
                return (
                  <>
                    {quoteT("labels.totalNet")}:{" "}
                    <strong>
                      {formatMoneyCents(totals.labor + totals.parts + totals.other, activeQuote.currency)}
                    </strong>
                    {" · "}{quoteT("labels.vat")}: <strong>{formatMoneyCents(totals.vat, activeQuote.currency)}</strong>
                    {" · "}{quoteT("labels.total")}:{" "}
                    <strong>{formatMoneyCents(totals.gross, activeQuote.currency)}</strong>
                  </>
                );
              })()}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canMoveQuote && hasLucrare2 ? (
              movePickerOpen ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950/80 px-2.5 py-1.5">
                  <span className="text-xs text-zinc-400">{quoteT("labels.moveTo")}</span>
                  {([1, 2] as const).map((n) => {
                    const current = quoteLucrareIndex(activeQuote);
                    const disabled = n === current || pending;
                    return (
                      <button
                        key={n}
                        type="button"
                        disabled={disabled}
                        onClick={() => void moveQuoteToLucrare(n)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium disabled:opacity-40 ${
                          n === current
                            ? "border border-zinc-700 text-zinc-500"
                            : "border border-violet-500/50 bg-violet-950/40 text-violet-100 hover:bg-violet-950/60"
                        }`}
                      >
                        L{n}
                        {n === current ? ` (${quoteT("labels.current")})` : ""}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setMovePickerOpen(false)}
                    className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800"
                  >
                    {quoteT("actions.cancel")}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  title={quoteT("tooltips.moveQuote")}
                  onClick={() => setMovePickerOpen(true)}
                  className="rounded-lg border border-zinc-600 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                >
                  {quoteT("actions.moveQuote")}
                </button>
              )
            ) : null}
            {canWrite && activeQuote.status === "draft" ? (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setTitle(activeQuote.title ?? "");
                    setLines(linesFromQuote(activeQuote));
                    setNotes(activeQuote.notes ?? "");
                    setEditingDraftId(activeQuote.id);
                  }}
                  className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                >
                  {quoteT("actions.edit")}
                </button>
                <button
                  type="button"
                  disabled={pending || !hasEstimatedRepair}
                  title={!hasEstimatedRepair ? quoteT("errors.estimatedRepairRequired") : undefined}
                  onClick={() => void quoteAction("submit")}
                  className="rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
                >
                  {quoteT("actions.submit")}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void deleteDraft()}
                  className="rounded-lg border border-red-800/60 px-2.5 py-1 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                >
                  {quoteT("actions.deleteDraft")}
                </button>
              </>
            ) : null}
            {canResubmitQuote && activeQuote.status === "submitted" ? (
              <button
                type="button"
                disabled={pending || !toIsoFromDateInput(estimatedDate)}
                title={
                  !toIsoFromDateInput(estimatedDate)
                    ? quoteT("tooltips.chooseNewEstimate")
                    : quoteT("tooltips.resubmit")
                }
                onClick={() => void resubmitForApproval()}
                className="rounded-lg border border-amber-500/50 bg-amber-950/40 px-2.5 py-1 text-xs font-medium text-amber-100 hover:bg-amber-950/60 disabled:opacity-50"
              >
                {quoteT("actions.resubmit")}
              </button>
            ) : null}
            {activeQuote.lines.some((line) => line.partsOrderStatus === "ordered") ? (
              <span className="rounded-full border border-amber-700/50 bg-amber-950/30 px-2 py-0.5 text-xs text-amber-200">
                {quoteT("aria.partsOrder")}
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
                {quoteT("actions.launchParts")}
              </button>
            ) : null}
          </div>
          {launchInfo ? <p className="text-sm text-amber-200/90">{launchInfo}</p> : null}
          {activeQuote.status === "submitted" ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-950/25 px-3 py-2 text-sm text-amber-50">
              <p className="font-medium">{quoteT("status.submitted")}</p>
              <p className="mt-0.5 text-xs text-amber-100/80">
                {activeQuote.submittedAt
                  ? `Trimis la ${new Date(activeQuote.submittedAt).toLocaleString("ro-RO", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}. `
                  : ""}
                {quoteT("messages.waitingApproval")}
                {canResubmitQuote
                  ? ` ${quoteT("messages.resubmitHint")}`
                  : ""}
              </p>
              {canResubmitQuote ? (
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <div>
                    <label className={`${OPS_LABEL_CLASS} text-amber-100/90`}>
                      {quoteT("fields.newEstimatedCompletion")} <span className="text-amber-300">*</span>
                    </label>
                    <input
                      type="date"
                      value={estimatedDate}
                      disabled={pending}
                      onChange={(e) => setEstimatedDate(e.target.value)}
                      className={`${OPS_INPUT_CLASS} max-w-xs`}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          {activeQuote.rejectionReason ? (
            <p className="text-sm text-red-300">{quoteT("labels.rejectionReason")}: {activeQuote.rejectionReason}</p>
          ) : null}
          {canWrite && activeQuote.status === "draft" ? (
            <div className="rounded-lg border border-amber-800/40 bg-amber-950/20 p-3">
              <label className={OPS_LABEL_CLASS}>
                {quoteT("fields.estimatedRepairCompletion")} <span className="text-amber-300">*</span>
              </label>
              {estimatedRepairAt ? (
                <>
                  <p className="text-sm text-zinc-200">
                    <span className="font-medium">{formatDateRo(estimatedRepairAt)}</span>
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {quoteT("messages.estimateAlreadySet")}
                  </p>
                </>
              ) : (
                <>
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
                    {quoteT("messages.estimateRequiredBeforeSubmit")}
                  </p>
                </>
              )}
            </div>
          ) : null}
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
                <th className="py-2 pr-2">{quoteT("fields.type")}</th>
                <th className="py-2 pr-2">{quoteT("fields.description")}</th>
                <th className="py-2 pr-2">{quoteT("fields.partCode")}</th>
                <th className="py-2 pr-2">{quoteT("fields.quantity")}</th>
                <th className="py-2 pr-2">{quoteT("fields.unitPrice")}</th>
                <th className="py-2 pr-2">{quoteT("fields.discount")}</th>
                <th className="py-2 pr-2">{quoteT("fields.vat")}</th>
                <th className="py-2 pr-2">{quoteT("labels.totalNet")}</th>
                <th className="py-2 pr-2">{quoteT("labels.approval")}</th>
                <th className="py-2">{quoteT("labels.parts")}</th>
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
                    <td className="py-2 pr-2 text-zinc-400">{quoteLineType(line.lineType)}</td>
                    <td className="py-2 pr-2">{line.description}</td>
                    <td className="py-2 pr-2 font-mono text-xs text-zinc-300">
                      {line.partNumber ?? (line.partCodeExempt ? quoteT("labels.noCode") : "—")}
                    </td>
                    <td className="py-2 pr-2 font-mono">{line.quantity}</td>
                    <td className="py-2 pr-2 font-mono">
                      {formatMoneyCents(line.unitNetCents)}
                      {priceVerifyByKey[line.id] ? (
                        <PriceVerifyHint result={priceVerifyByKey[line.id]} canApply={false} tx={tx} />
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
                            aria-label={quoteT("actions.approveLine")}
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
                            aria-label={quoteT("actions.reject")}
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
                          {approvalLabel(displayedApproval)}
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
                              aria-label={quoteT("aria.partsOrder")}
                            >
                              <option value="none">{partsOrderLabel("none")}</option>
                              <option value="ordered">{partsOrderLabel("ordered")}</option>
                              <option value="in_stock">{partsOrderLabel("in_stock")}</option>
                              <option value="delivered">{partsOrderLabel("delivered")}</option>
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
                              aria-label={quoteT("aria.partsDate")}
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-400">
                            {partsOrderLabel(line.partsOrderStatus)}
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
              tx={tx}
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
                {quoteT("actions.approveAll")}
              </button>
              <button
                type="button"
                disabled={pending || !hasLineDecisions}
                onClick={() => void approveSelection()}
                className="rounded-lg border border-emerald-500/50 px-3 py-1.5 text-sm text-emerald-200 hover:bg-emerald-950/40 disabled:opacity-50"
              >
                {quoteT("actions.approveSelection")}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => void quoteAction("reject")}
                className="rounded-lg border border-red-500/50 px-3 py-1.5 text-sm text-red-200 hover:bg-red-950/40 disabled:opacity-50"
              >
                {quoteT("actions.reject")}
              </button>
            </div>
          ) : null}

          {activeQuote.status === "approved" ? (
            <div className="mt-4 space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
              <p className="text-xs uppercase text-zinc-500">{quoteT("invoice.invoiceAndCost")}</p>
              {isPartner && !activeQuote.invoicedAt ? (
                <p className="text-[11px] text-zinc-500">
                  {quoteT("invoice.uploadHint")}
                </p>
              ) : null}

              {activeQuote.invoicedAt ? (
                <p className="text-sm text-emerald-300">
                  {quoteT("invoice.invoice")}: {activeQuote.costInvoiceNumber ?? "—"}
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
                        {quoteT("invoice.pdf")}
                      </a>
                    </>
                  ) : null}
                  {activeQuote.invoiceMismatch ? (
                    <span className="mt-1 block text-amber-300">
                      {quoteT("invoice.grossMismatch")}
                    </span>
                  ) : null}
                </p>
              ) : canWrite ? (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className={OPS_LABEL_CLASS}>{quoteT("fields.invoiceNumber")}</label>
                      <input
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        className={OPS_INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className={OPS_LABEL_CLASS}>{quoteT("fields.invoiceDate")}</label>
                      <input
                        type="date"
                        value={invoiceDate}
                        onChange={(e) => setInvoiceDate(e.target.value)}
                        className={OPS_INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className={OPS_LABEL_CLASS}>{quoteT("fields.grossAmountRon")}</label>
                      <input
                        value={invoiceGross}
                        onChange={(e) => setInvoiceGross(e.target.value)}
                        className={OPS_INPUT_CLASS}
                        inputMode="decimal"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500">
                    {quoteT("invoice.totalQuote")}:{" "}
                    {formatMoneyCents(
                      activeQuote.approvedGrossCents ?? activeQuote.totalGrossCents,
                      activeQuote.currency,
                    )}
                    . Dacă suma facturii e alta, devizul rămâne marcat.
                  </p>
                  <InvoiceAttachmentField
                    value={invoiceAttachmentUrl}
                    onChange={setInvoiceAttachmentUrl}
                    invoiceNumber={invoiceNumber}
                    disabled={pending}
                  />
                  <button
                    type="button"
                    disabled={pending || !invoiceNumber.trim() || !invoiceDate}
                    onClick={() => void recordInvoice()}
                    className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm text-white hover:bg-violet-500 disabled:opacity-50"
                  >
                  {quoteT("actions.recordInvoice")}
                  </button>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">{quoteT("invoice.invoiceNotRecorded")}</p>
              )}

              {activeQuote.costEntryId ? (
                <p className="text-sm">
                  {quoteT("invoice.costRecorded")}
                  {!isPartner ? (
                    <>
                      {": "}
                      <Link href={`/fleet/costs/${activeQuote.costEntryId}`} className="text-sky-300 hover:underline">
                        {quoteT("invoice.viewCost")}
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
                  {quoteT("actions.generateCost")}
                </button>
              ) : activeQuote.invoicedAt && isPartner && !activeQuote.costEntryId ? (
                <p className="text-sm text-zinc-500">{quoteT("invoice.fleetGeneratesCost")}</p>
              ) : !activeQuote.invoicedAt ? (
                <p className="text-sm text-zinc-500">{quoteT("invoice.recordBeforeCost")}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === "quote" &&
      quotePane === "lines" &&
      (isEditingDraft || quotes.length === 0 || isCreatingDraft) &&
      canWrite ? (
        <div className="mt-4 space-y-4">
          <label className="block max-w-sm space-y-1">
            <span className={OPS_LABEL_CLASS}>{quoteT("fields.title")}</span>
            <input
              type="text"
              value={title}
              disabled={pending}
              placeholder={quoteT("placeholders.title")}
              onChange={(e) => setTitle(e.target.value)}
              className={OPS_INPUT_CLASS}
            />
          </label>
          {activeMenuItems.length ? (
            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
              <label className="min-w-[16rem] flex-1 space-y-1">
                <span className={OPS_LABEL_CLASS}>{quoteT("fields.menu")}</span>
                <select
                  value={selectedMenuItemId}
                  onChange={(e) => setSelectedMenuItemId(e.target.value)}
                  className={OPS_INPUT_CLASS}
                  disabled={pending}
                >
                  <option value="">{quoteT("placeholders.chooseMenu")}</option>
                  {activeMenuItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label} · {supplierMenuLineTypeLabel(item.lineType)} · {centsToLei(item.unitNetCents)} RON
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={pending || !selectedMenuItemId}
                onClick={addMenuLine}
                className="rounded-lg border border-violet-500/50 bg-violet-950/40 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-950/60 disabled:opacity-50"
              >
                {quoteT("actions.addFromMenu")}
              </button>
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
                  <th className="py-2 pr-2">{quoteT("fields.type")}</th>
                  <th className="py-2 pr-2">{quoteT("fields.description")}</th>
                  <th className="py-2 pr-2">{quoteT("fields.partCode")}</th>
                  <th className="py-2 pr-2">{quoteT("fields.quantity")}</th>
                  <th className="py-2 pr-2">{quoteT("fields.unitNet")}</th>
                  <th className="py-2 pr-2">{quoteT("fields.discountPercent")}</th>
                  <th className="py-2 pr-2">{quoteT("fields.discountLei")}</th>
                  <th className="py-2 pr-2">{quoteT("fields.vat")}</th>
                  <th className="py-2 pr-2">{quoteT("labels.net")}</th>
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
                          if (nextType === "labor" && !line.unitNetLei.trim()) {
                            updated.unitNetLei = defaultLaborUnitLei(supplierDiscounts);
                          }
                          next[idx] = updated;
                          setLines(next);
                        }}
                        className={OPS_INPUT_CLASS}
                      >
                        <option value="parts">{quoteT("lineTypes.parts")}</option>
                        <option value="labor">{quoteT("lineTypes.labor")}</option>
                        <option value="other">{quoteT("lineTypes.other")}</option>
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
                        placeholder={quoteT("fields.lineDescription")}
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
                          placeholder={
                            line.lineType === "parts" && requirePartCode
                              ? quoteT("placeholders.required")
                              : quoteT("placeholders.optional")
                          }
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
                          {quoteT("labels.noCode")}
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
                          tx={tx}
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
                        title={quoteT("tooltips.discountPercent")}
                        aria-label={quoteT("fields.discountPercent")}
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
                        title={quoteT("tooltips.discountLei")}
                        aria-label={quoteT("fields.discountLei")}
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
                        aria-label={quoteT("actions.deleteLine")}
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
              {quoteT("actions.addLine")}
            </button>
          ) : null}
          <div>
            <label className={OPS_LABEL_CLASS}>{quoteT("fields.notes")}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={OPS_INPUT_CLASS}
            />
          </div>
          {canWrite && draftQuote ? (
            <div className="rounded-lg border border-amber-800/40 bg-amber-950/20 p-3">
              <label className={OPS_LABEL_CLASS}>
                {quoteT("fields.estimatedRepairCompletion")} <span className="text-amber-300">*</span>
              </label>
              {estimatedRepairAt ? (
                <>
                  <p className="text-sm text-zinc-200">
                    <span className="font-medium">{formatDateRo(estimatedRepairAt)}</span>
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {quoteT("messages.estimateAlreadySetDraft")}
                  </p>
                </>
              ) : (
                <>
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
                    {quoteT("messages.estimatePartnerRequired")}
                  </p>
                </>
              )}
            </div>
          ) : estimatedRepairAt ? (
            <p className="text-sm text-zinc-400">
              {quoteT("fields.estimatedRepairCompletion")}:{" "}
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
                {quoteT("actions.saveDraft")}
              </button>
              {draftQuote ? (
                <>
                  <button
                    type="button"
                    disabled={pending || !hasEstimatedRepair}
                    title={!hasEstimatedRepair ? quoteT("errors.estimatedRepairRequired") : undefined}
                    onClick={() => void quoteAction("submit")}
                    className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm text-white hover:bg-sky-500 disabled:opacity-50"
                  >
                    {quoteT("actions.submit")}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void deleteDraft()}
                    className="rounded-lg border border-red-800/60 px-3 py-1.5 text-sm text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                  >
                    {quoteT("actions.deleteDraft")}
                  </button>
                </>
              ) : null}
            </div>
            <QuoteSubtotals
              labor={previewTotals.labor}
              parts={previewTotals.parts}
              other={previewTotals.other}
              vat={previewTotals.vat}
              gross={previewTotals.gross}
              tx={tx}
            />
          </div>
        </div>
      ) : null}

      {activeTab === "quote" && !canWrite && quotes.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">{quoteT("empty.noQuotesReadOnly")}</p>
      ) : null}
    </section>
  );
}

function PriceVerifyHint({
  result,
  canApply,
  onApply,
  tx,
}: {
  result: PartsPriceVerifyLineResult;
  canApply: boolean;
  onApply?: () => void;
  tx: (key: string) => string;
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
          ? `${tx("workOrders.quote.priceVerify.suspect")} +${result.deltaPercent}%`
          : result.status === "ok"
            ? result.deltaPercent != null && result.deltaPercent <= 0
              ? tx("workOrders.quote.priceVerify.atOrBelowCatalog")
              : tx("workOrders.quote.priceVerify.withinThreshold")
            : result.status === "no_code"
              ? tx("workOrders.quote.priceVerify.noCode")
              : tx("workOrders.quote.priceVerify.noOffer")}
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
          {tx("workOrders.quote.actions.applyCatalogPrice")}
        </button>
      ) : null}
    </div>
  );
}
