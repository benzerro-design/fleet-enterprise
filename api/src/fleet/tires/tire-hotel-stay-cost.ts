import type { Prisma } from '@prisma/client';

export const TIRE_HOTEL_COST_CATEGORY = 'Anvelope';

type Db = { costEntry: Prisma.TransactionClient['costEntry']; supplier: Prisma.TransactionClient['supplier'] };

export type TireStayCostInvoicePatch = {
  invoiceNumber?: string | null;
  invoiceDate?: Date | null;
  invoiceAttachmentUrl?: string | null;
};

/** Creează CostEntry legat de stay dacă feeCents > 0 și lipsește deja. */
export async function ensureTireStorageStayCostTx(
  tx: Db,
  params: {
    tenantId: string;
    stayId: string;
    vehicleId: string;
    setId: string;
    supplierId: string;
    feeCents: number | null | undefined;
    plate?: string | null;
    checkOutAt?: Date | null;
    invoice?: TireStayCostInvoicePatch;
  },
): Promise<string | null> {
  const feeCents = params.feeCents != null && params.feeCents > 0 ? Math.round(params.feeCents) : null;
  if (feeCents == null) return null;

  const invoiceData: TireStayCostInvoicePatch = {};
  if (params.invoice) {
    if (params.invoice.invoiceNumber !== undefined) {
      invoiceData.invoiceNumber = params.invoice.invoiceNumber?.trim() || null;
    }
    if (params.invoice.invoiceDate !== undefined) {
      invoiceData.invoiceDate = params.invoice.invoiceDate;
    }
    if (params.invoice.invoiceAttachmentUrl !== undefined) {
      invoiceData.invoiceAttachmentUrl = params.invoice.invoiceAttachmentUrl?.trim() || null;
    }
  }

  const existing = await tx.costEntry.findFirst({
    where: { tenantId: params.tenantId, tireStorageStayId: params.stayId },
    select: { id: true, amountCents: true },
    orderBy: { incurredOn: 'desc' },
  });
  if (existing) {
    const patch: Prisma.CostEntryUpdateInput = {};
    if (existing.amountCents !== feeCents) patch.amountCents = feeCents;
    if (invoiceData.invoiceNumber !== undefined) patch.invoiceNumber = invoiceData.invoiceNumber;
    if (invoiceData.invoiceDate !== undefined) patch.invoiceDate = invoiceData.invoiceDate;
    if (invoiceData.invoiceAttachmentUrl !== undefined) {
      patch.invoiceAttachmentUrl = invoiceData.invoiceAttachmentUrl;
    }
    if (Object.keys(patch).length > 0) {
      await tx.costEntry.update({ where: { id: existing.id }, data: patch });
    }
    return existing.id;
  }

  const supplier = await tx.supplier.findFirst({
    where: { id: params.supplierId, tenantId: params.tenantId },
    select: { legalName: true },
  });
  const plate = params.plate?.trim() || null;
  const incurredOn = params.checkOutAt ?? new Date();
  const row = await tx.costEntry.create({
    data: {
      tenantId: params.tenantId,
      vehicleId: params.vehicleId,
      category: TIRE_HOTEL_COST_CATEGORY,
      amountCents: feeCents,
      supplierId: params.supplierId,
      provider: supplier?.legalName?.trim() || null,
      tireSetId: params.setId,
      tireStorageStayId: params.stayId,
      incurredOn,
      notes: plate
        ? `Depozitare hotel anvelope · ${plate} (stay ${params.stayId})`
        : `Depozitare hotel anvelope (stay ${params.stayId})`,
      invoiceNumber: invoiceData.invoiceNumber ?? undefined,
      invoiceDate: invoiceData.invoiceDate ?? undefined,
      invoiceAttachmentUrl: invoiceData.invoiceAttachmentUrl ?? undefined,
    },
    select: { id: true },
  });
  return row.id;
}

export type TireStayCostPrintableSummary = {
  costEntryId: string;
  amountCents: number;
  category: string;
  provider: string | null;
  incurredOn: string;
  plate: string | null;
  stayId: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  feeCents: number | null;
  lines: string[];
};

export function buildTireStayCostPrintableSummary(input: {
  costEntryId: string;
  amountCents: number;
  category: string;
  provider: string | null;
  incurredOn: Date;
  plate: string | null;
  stayId: string;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  feeCents: number | null;
}): TireStayCostPrintableSummary {
  const lei = (input.amountCents / 100).toLocaleString('ro-RO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const lines = [
    'Sumar cost depozitare anvelope',
    input.plate ? `Vehicul: ${input.plate}` : undefined,
    `Sejur: ${input.stayId}`,
    input.checkInAt ? `Check-in: ${input.checkInAt.toISOString()}` : undefined,
    input.checkOutAt ? `Check-out: ${input.checkOutAt.toISOString()}` : undefined,
    `Categorie: ${input.category}`,
    input.provider ? `Furnizor: ${input.provider}` : undefined,
    `Total: ${lei} RON`,
    `Cost ID: ${input.costEntryId}`,
  ].filter((l): l is string => !!l);

  return {
    costEntryId: input.costEntryId,
    amountCents: input.amountCents,
    category: input.category,
    provider: input.provider,
    incurredOn: input.incurredOn.toISOString(),
    plate: input.plate,
    stayId: input.stayId,
    checkInAt: input.checkInAt ? input.checkInAt.toISOString() : null,
    checkOutAt: input.checkOutAt ? input.checkOutAt.toISOString() : null,
    feeCents: input.feeCents,
    lines,
  };
}
