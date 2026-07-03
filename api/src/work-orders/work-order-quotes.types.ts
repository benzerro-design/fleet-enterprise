import {
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

export function toQuoteLineRecord(line: {
  id: string;
  sortOrder: number;
  lineType: WorkOrderQuoteLineType;
  description: string;
  quantity: number;
  unitNetCents: number;
  vatRatePercent: number;
  partNumber: string | null;
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
