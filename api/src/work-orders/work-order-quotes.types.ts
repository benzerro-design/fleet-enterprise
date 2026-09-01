import {
  QuotePartsOrderStatus,
  WorkOrderQuoteLineApproval,
  WorkOrderQuoteLineType,
  WorkOrderQuoteStatus,
} from '@prisma/client';

export type QuoteLineInput = {
  lineType?: WorkOrderQuoteLineType;
  description: string;
  quantity?: number;
  unitNetCents: number;
  vatRatePercent?: number;
  /** 0–100. Dacă > 0, are prioritate față de discountCents. */
  discountPercent?: number | null;
  discountCents?: number | null;
  partNumber?: string | null;
  partCodeExempt?: boolean;
  approvalStatus?: WorkOrderQuoteLineApproval;
  partsOrderStatus?: QuotePartsOrderStatus;
  partsExpectedOn?: string | Date | null;
  warrantyMonths?: number | null;
  warrantyKm?: number | null;
  sortOrder?: number;
};

export type SupplierQuoteDiscountDefaults = {
  partsDiscountPercent?: number | null;
  laborDiscountPercent?: number | null;
};

export type QuoteLineRecord = {
  id: string;
  sortOrder: number;
  lineType: WorkOrderQuoteLineType;
  description: string;
  quantity: number;
  unitNetCents: number;
  vatRatePercent: number;
  discountPercent: number;
  discountCents: number;
  discountAppliedCents: number;
  partNumber: string | null;
  partCodeExempt: boolean;
  approvalStatus: WorkOrderQuoteLineApproval;
  partsOrderStatus: QuotePartsOrderStatus;
  partsExpectedOn: string | null;
  warrantyMonths: number | null;
  warrantyKm: number | null;
  lineNetCents: number;
  lineVatCents: number;
};

export type WorkOrderQuoteRecord = {
  id: string;
  workOrderId: string;
  version: number;
  status: WorkOrderQuoteStatus;
  currency: string;
  totalNetCents: number;
  totalVatCents: number;
  totalGrossCents: number;
  approvedNetCents: number | null;
  approvedVatCents: number | null;
  approvedGrossCents: number | null;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  notes: string | null;
  costEntryId: string | null;
  invoicedAt: string | null;
  costInvoiceNumber: string | null;
  costInvoiceDate: string | null;
  createdAt: string;
  updatedAt: string;
  lines: QuoteLineRecord[];
};

export type QuoteLineMoneyInput = {
  quantity: number;
  unitNetCents: number;
  vatRatePercent: number;
  discountPercent?: number | null;
  discountCents?: number | null;
};

export function defaultDiscountPercent(
  lineType: WorkOrderQuoteLineType | string | undefined,
  supplier?: SupplierQuoteDiscountDefaults | null,
): number {
  if (!supplier) return 0;
  if (lineType === 'parts') return Number(supplier.partsDiscountPercent) || 0;
  if (lineType === 'labor') return Number(supplier.laborDiscountPercent) || 0;
  return 0;
}

/** Dacă % > 0, folosește procentul; altfel suma. Nu trece de brutul liniei. */
export function computeDiscountAppliedCents(line: QuoteLineMoneyInput): number {
  const gross = Math.round(line.quantity * line.unitNetCents);
  const pct = Number(line.discountPercent) || 0;
  if (pct > 0) {
    return Math.min(gross, Math.round((gross * pct) / 100));
  }
  const cents = Math.round(Number(line.discountCents) || 0);
  return Math.min(gross, Math.max(0, cents));
}

export function computeLineAmounts(line: QuoteLineMoneyInput): {
  lineNetCents: number;
  lineVatCents: number;
  discountAppliedCents: number;
} {
  const gross = Math.round(line.quantity * line.unitNetCents);
  const discountAppliedCents = computeDiscountAppliedCents(line);
  const lineNetCents = Math.max(0, gross - discountAppliedCents);
  const lineVatCents = Math.round((lineNetCents * line.vatRatePercent) / 100);
  return { lineNetCents, lineVatCents, discountAppliedCents };
}

export function computeQuoteTotals(lines: QuoteLineMoneyInput[]): {
  totalNetCents: number;
  totalVatCents: number;
} {
  let totalNetCents = 0;
  let totalVatCents = 0;
  for (const line of lines) {
    const { lineNetCents, lineVatCents } = computeLineAmounts(line);
    totalNetCents += lineNetCents;
    totalVatCents += lineVatCents;
  }
  return { totalNetCents, totalVatCents };
}

export function computeApprovedTotals(
  lines: Array<
    QuoteLineMoneyInput & {
      approvalStatus?: WorkOrderQuoteLineApproval | null;
    }
  >,
): { totalNetCents: number; totalVatCents: number } {
  const hasDecision = lines.some((line) => line.approvalStatus && line.approvalStatus !== 'pending');
  return computeQuoteTotals(
    hasDecision ? lines.filter((line) => line.approvalStatus === 'approved') : lines,
  );
}

/** Total afișat: dacă există linii respinse/aprobate, doar cele approved. */
export function displayQuoteMoneyTotals(quote: {
  totalNetCents: number;
  totalVatCents: number;
  approvedNetCents?: number | null;
  approvedVatCents?: number | null;
  lines?: Array<
    QuoteLineMoneyInput & {
      approvalStatus?: WorkOrderQuoteLineApproval | null;
    }
  >;
}): { totalNetCents: number; totalVatCents: number; totalGrossCents: number } {
  if (quote.approvedNetCents != null && quote.approvedVatCents != null) {
    return {
      totalNetCents: quote.approvedNetCents,
      totalVatCents: quote.approvedVatCents,
      totalGrossCents: quote.approvedNetCents + quote.approvedVatCents,
    };
  }
  if (quote.lines?.length) {
    const decided = computeApprovedTotals(quote.lines);
    return {
      totalNetCents: decided.totalNetCents,
      totalVatCents: decided.totalVatCents,
      totalGrossCents: decided.totalNetCents + decided.totalVatCents,
    };
  }
  return {
    totalNetCents: quote.totalNetCents,
    totalVatCents: quote.totalVatCents,
    totalGrossCents: quote.totalNetCents + quote.totalVatCents,
  };
}

export function toQuoteLineRecord(line: {
  id: string;
  sortOrder: number;
  lineType: WorkOrderQuoteLineType;
  description: string;
  quantity: number;
  unitNetCents: number;
  vatRatePercent: number;
  discountPercent?: number | null;
  discountCents?: number | null;
  partNumber: string | null;
  partCodeExempt: boolean;
  approvalStatus: WorkOrderQuoteLineApproval;
  partsOrderStatus: QuotePartsOrderStatus;
  partsExpectedOn: Date | null;
  warrantyMonths: number | null;
  warrantyKm: number | null;
}): QuoteLineRecord {
  const discountPercent = Number(line.discountPercent) || 0;
  const discountCents = Math.round(Number(line.discountCents) || 0);
  const { lineNetCents, lineVatCents, discountAppliedCents } = computeLineAmounts({
    ...line,
    discountPercent,
    discountCents,
  });
  return {
    id: line.id,
    sortOrder: line.sortOrder,
    lineType: line.lineType,
    description: line.description,
    quantity: line.quantity,
    unitNetCents: line.unitNetCents,
    vatRatePercent: line.vatRatePercent,
    discountPercent,
    discountCents,
    discountAppliedCents,
    partNumber: line.partNumber,
    partCodeExempt: line.partCodeExempt,
    approvalStatus: line.approvalStatus,
    partsOrderStatus: line.partsOrderStatus,
    partsExpectedOn: line.partsExpectedOn?.toISOString() ?? null,
    warrantyMonths: line.warrantyMonths,
    warrantyKm: line.warrantyKm,
    lineNetCents,
    lineVatCents,
  };
}

export function toQuoteRecord(quote: {
  id: string;
  workOrderId: string;
  version: number;
  status: WorkOrderQuoteStatus;
  currency: string;
  totalNetCents: number;
  totalVatCents: number;
  approvedNetCents: number | null;
  approvedVatCents: number | null;
  submittedAt: Date | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  notes: string | null;
  costEntryId: string | null;
  invoicedAt: Date | null;
  invoiceNumber?: string | null;
  invoiceDate?: Date | null;
  invoiceAttachmentUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
  costEntry?: {
    invoiceNumber: string | null;
    invoiceDate: Date | null;
  } | null;
  lines: Array<{
    id: string;
    sortOrder: number;
    lineType: WorkOrderQuoteLineType;
    description: string;
    quantity: number;
    unitNetCents: number;
    vatRatePercent: number;
    discountPercent?: number | null;
    discountCents?: number | null;
    partNumber: string | null;
    partCodeExempt: boolean;
    approvalStatus: WorkOrderQuoteLineApproval;
    partsOrderStatus: QuotePartsOrderStatus;
    partsExpectedOn: Date | null;
    warrantyMonths: number | null;
    warrantyKm: number | null;
  }>;
}): WorkOrderQuoteRecord {
  const money = displayQuoteMoneyTotals(quote);
  return {
    id: quote.id,
    workOrderId: quote.workOrderId,
    version: quote.version,
    status: quote.status,
    currency: quote.currency,
    totalNetCents: money.totalNetCents,
    totalVatCents: money.totalVatCents,
    totalGrossCents: money.totalGrossCents,
    approvedNetCents: quote.approvedNetCents,
    approvedVatCents: quote.approvedVatCents,
    approvedGrossCents:
      quote.approvedNetCents == null || quote.approvedVatCents == null
        ? null
        : quote.approvedNetCents + quote.approvedVatCents,
    submittedAt: quote.submittedAt?.toISOString() ?? null,
    approvedAt: quote.approvedAt?.toISOString() ?? null,
    rejectedAt: quote.rejectedAt?.toISOString() ?? null,
    rejectionReason: quote.rejectionReason,
    notes: quote.notes,
    costEntryId: quote.costEntryId,
    invoicedAt: quote.invoicedAt?.toISOString() ?? null,
    costInvoiceNumber: quote.invoiceNumber ?? quote.costEntry?.invoiceNumber ?? null,
    costInvoiceDate: quote.invoiceDate?.toISOString() ?? quote.costEntry?.invoiceDate?.toISOString() ?? null,
    createdAt: quote.createdAt.toISOString(),
    updatedAt: quote.updatedAt.toISOString(),
    lines: quote.lines.map(toQuoteLineRecord),
  };
}
