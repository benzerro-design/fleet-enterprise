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
  partNumber?: string | null;
  partCodeExempt?: boolean;
  approvalStatus?: WorkOrderQuoteLineApproval;
  partsOrderStatus?: QuotePartsOrderStatus;
  partsExpectedOn?: string | Date | null;
  warrantyMonths?: number | null;
  warrantyKm?: number | null;
  sortOrder?: number;
};

export type QuoteLineRecord = {
  id: string;
  sortOrder: number;
  lineType: WorkOrderQuoteLineType;
  description: string;
  quantity: number;
  unitNetCents: number;
  vatRatePercent: number;
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

export function computeLineAmounts(line: {
  quantity: number;
  unitNetCents: number;
  vatRatePercent: number;
}): { lineNetCents: number; lineVatCents: number } {
  const lineNetCents = Math.round(line.quantity * line.unitNetCents);
  const lineVatCents = Math.round((lineNetCents * line.vatRatePercent) / 100);
  return { lineNetCents, lineVatCents };
}

export function computeQuoteTotals(
  lines: Array<{ quantity: number; unitNetCents: number; vatRatePercent: number }>,
): { totalNetCents: number; totalVatCents: number } {
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
  lines: Array<{
    quantity: number;
    unitNetCents: number;
    vatRatePercent: number;
    approvalStatus?: WorkOrderQuoteLineApproval | null;
  }>,
): { totalNetCents: number; totalVatCents: number } {
  const hasDecision = lines.some((line) => line.approvalStatus && line.approvalStatus !== 'pending');
  return computeQuoteTotals(
    hasDecision ? lines.filter((line) => line.approvalStatus === 'approved') : lines,
  );
}

export function toQuoteLineRecord(line: {
  id: string;
  sortOrder: number;
  lineType: WorkOrderQuoteLineType;
  description: string;
  quantity: number;
  unitNetCents: number;
  vatRatePercent: number;
  partNumber: string | null;
  partCodeExempt: boolean;
  approvalStatus: WorkOrderQuoteLineApproval;
  partsOrderStatus: QuotePartsOrderStatus;
  partsExpectedOn: Date | null;
  warrantyMonths: number | null;
  warrantyKm: number | null;
}): QuoteLineRecord {
  const { lineNetCents, lineVatCents } = computeLineAmounts(line);
  return {
    id: line.id,
    sortOrder: line.sortOrder,
    lineType: line.lineType,
    description: line.description,
    quantity: line.quantity,
    unitNetCents: line.unitNetCents,
    vatRatePercent: line.vatRatePercent,
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
    partNumber: string | null;
    partCodeExempt: boolean;
    approvalStatus: WorkOrderQuoteLineApproval;
    partsOrderStatus: QuotePartsOrderStatus;
    partsExpectedOn: Date | null;
    warrantyMonths: number | null;
    warrantyKm: number | null;
  }>;
}): WorkOrderQuoteRecord {
  return {
    id: quote.id,
    workOrderId: quote.workOrderId,
    version: quote.version,
    status: quote.status,
    currency: quote.currency,
    totalNetCents: quote.totalNetCents,
    totalVatCents: quote.totalVatCents,
    totalGrossCents: quote.totalNetCents + quote.totalVatCents,
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
