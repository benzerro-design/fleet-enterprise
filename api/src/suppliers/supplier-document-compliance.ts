import { BadRequestException } from '@nestjs/common';
import type { PrismaClient, SupplierDocument } from '@prisma/client';

const EXPIRING_SOON_DAYS = 60;

export type SupplierDocumentCompliance = {
  ok: boolean;
  expiredRequired: Array<{ id: string; title: string; expiresOn: string }>;
  expiringSoon: Array<{ id: string; title: string; expiresOn: string; daysLeft: number }>;
};

function startOfUtcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function documentExpiryStatus(
  expiresOn: Date | null,
  now = startOfUtcDay(),
): 'valid' | 'expiring_soon' | 'expired' | 'none' {
  if (!expiresOn) return 'none';
  const exp = startOfUtcDay(expiresOn);
  if (exp.getTime() < now.getTime()) return 'expired';
  const ms = exp.getTime() - now.getTime();
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  if (days <= EXPIRING_SOON_DAYS) return 'expiring_soon';
  return 'valid';
}

export function daysUntilExpiry(expiresOn: Date, now = startOfUtcDay()): number {
  const exp = startOfUtcDay(expiresOn);
  return Math.ceil((exp.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

export async function getSupplierDocumentCompliance(
  prisma: PrismaClient,
  tenantId: string,
  supplierId: string,
): Promise<SupplierDocumentCompliance> {
  const rows = await prisma.supplierDocument.findMany({
    where: { tenantId, supplierId },
    select: { id: true, title: true, expiresOn: true, required: true },
  });
  const now = startOfUtcDay();
  const expiredRequired: SupplierDocumentCompliance['expiredRequired'] = [];
  const expiringSoon: SupplierDocumentCompliance['expiringSoon'] = [];
  for (const r of rows) {
    if (!r.expiresOn) continue;
    const status = documentExpiryStatus(r.expiresOn, now);
    if (status === 'expired' && r.required) {
      expiredRequired.push({
        id: r.id,
        title: r.title,
        expiresOn: r.expiresOn.toISOString().slice(0, 10),
      });
    } else if (status === 'expiring_soon') {
      expiringSoon.push({
        id: r.id,
        title: r.title,
        expiresOn: r.expiresOn.toISOString().slice(0, 10),
        daysLeft: daysUntilExpiry(r.expiresOn, now),
      });
    }
  }
  return {
    ok: expiredRequired.length === 0,
    expiredRequired,
    expiringSoon,
  };
}

/** Blochează accept / alocare comenzi dacă există documente obligatorii expirate. */
export async function assertSupplierDocumentsAllowOrders(
  prisma: PrismaClient,
  tenantId: string,
  supplierId: string | null | undefined,
): Promise<void> {
  if (!supplierId) return;
  const c = await getSupplierDocumentCompliance(prisma, tenantId, supplierId);
  if (c.ok) return;
  const names = c.expiredRequired.map((d) => d.title).join(', ');
  throw new BadRequestException(
    `Furnizorul are documente obligatorii expirate (${names}). Reîncarcă documentele înainte de a accepta comenzi.`,
  );
}

export function mapSupplierDocumentRow(row: SupplierDocument) {
  const status = documentExpiryStatus(row.expiresOn);
  return {
    id: row.id,
    supplierId: row.supplierId,
    kind: row.kind,
    title: row.title,
    fileUrl: row.fileUrl,
    fileName: row.fileName,
    mimeType: row.mimeType,
    expiresOn: row.expiresOn ? row.expiresOn.toISOString().slice(0, 10) : null,
    required: row.required,
    expiryStatus: status,
    daysLeft:
      row.expiresOn && (status === 'valid' || status === 'expiring_soon')
        ? daysUntilExpiry(row.expiresOn)
        : status === 'expired' && row.expiresOn
          ? daysUntilExpiry(row.expiresOn)
          : null,
    uploadedByUserId: row.uploadedByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
