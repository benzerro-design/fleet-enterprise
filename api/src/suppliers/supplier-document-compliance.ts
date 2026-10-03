import { BadRequestException } from '@nestjs/common';
import type { PrismaClient, SupplierDocument } from '@prisma/client';
import {
  parseSupplierSettings,
  requiredOnboardingKindCodes,
  type SupplierSettings,
} from '../tenant/supplier-settings';

export type SupplierDocumentCompliance = {
  ok: boolean;
  expiredRequired: Array<{ id: string; title: string; expiresOn: string }>;
  expiringSoon: Array<{ id: string; title: string; expiresOn: string; daysLeft: number }>;
  missingRequiredKinds: Array<{ code: string; label: string }>;
};

function startOfUtcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function documentExpiryStatus(
  expiresOn: Date | null,
  now = startOfUtcDay(),
  expiringSoonDays = 60,
): 'valid' | 'expiring_soon' | 'expired' | 'none' {
  if (!expiresOn) return 'none';
  const exp = startOfUtcDay(expiresOn);
  if (exp.getTime() < now.getTime()) return 'expired';
  const ms = exp.getTime() - now.getTime();
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  if (days <= expiringSoonDays) return 'expiring_soon';
  return 'valid';
}

export function daysUntilExpiry(expiresOn: Date, now = startOfUtcDay()): number {
  const exp = startOfUtcDay(expiresOn);
  return Math.ceil((exp.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

async function loadSupplierSettings(
  prisma: PrismaClient,
  tenantId: string,
): Promise<SupplierSettings> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { supplierSettings: true },
  });
  return parseSupplierSettings(tenant?.supplierSettings);
}

export async function getSupplierDocumentCompliance(
  prisma: PrismaClient,
  tenantId: string,
  supplierId: string,
): Promise<SupplierDocumentCompliance> {
  const settings = await loadSupplierSettings(prisma, tenantId);
  const rows = await prisma.supplierDocument.findMany({
    where: { tenantId, supplierId },
    select: { id: true, title: true, expiresOn: true, required: true, kind: true },
  });
  const now = startOfUtcDay();
  const expiredRequired: SupplierDocumentCompliance['expiredRequired'] = [];
  const expiringSoon: SupplierDocumentCompliance['expiringSoon'] = [];
  for (const r of rows) {
    if (!r.expiresOn) continue;
    const status = documentExpiryStatus(r.expiresOn, now, settings.expiringSoonDays);
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

  const presentKinds = new Set(rows.map((r) => r.kind));
  const missingRequiredKinds = settings.onboardingDocKinds
    .filter((k) => k.enabled && k.requiredByDefault && !presentKinds.has(k.code))
    .map((k) => ({ code: k.code, label: k.label }));

  const expiredBlocks = settings.blockOrdersOnExpiredRequiredDocs && expiredRequired.length > 0;
  const missingBlocks =
    settings.blockOrdersOnMissingRequiredKinds && missingRequiredKinds.length > 0;

  return {
    ok: !expiredBlocks && !missingBlocks,
    expiredRequired,
    expiringSoon,
    missingRequiredKinds,
  };
}

/** Blochează accept / alocare comenzi după setările Setup Furnizori. */
export async function assertSupplierDocumentsAllowOrders(
  prisma: PrismaClient,
  tenantId: string,
  supplierId: string | null | undefined,
): Promise<void> {
  if (!supplierId) return;
  const settings = await loadSupplierSettings(prisma, tenantId);
  if (!settings.blockOrdersOnExpiredRequiredDocs && !settings.blockOrdersOnMissingRequiredKinds) {
    return;
  }
  const c = await getSupplierDocumentCompliance(prisma, tenantId, supplierId);
  if (c.ok) return;
  const parts: string[] = [];
  if (settings.blockOrdersOnExpiredRequiredDocs && c.expiredRequired.length) {
    parts.push(`expirate: ${c.expiredRequired.map((d) => d.title).join(', ')}`);
  }
  if (settings.blockOrdersOnMissingRequiredKinds && c.missingRequiredKinds.length) {
    parts.push(`lipsă: ${c.missingRequiredKinds.map((d) => d.label).join(', ')}`);
  }
  if (parts.length === 0) return;
  throw new BadRequestException(
    `Furnizorul nu trece compliance documente (${parts.join('; ')}). Actualizează documentele înainte de a accepta comenzi.`,
  );
}

export function mapSupplierDocumentRow(
  row: SupplierDocument,
  expiringSoonDays = 60,
) {
  const status = documentExpiryStatus(row.expiresOn, startOfUtcDay(), expiringSoonDays);
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

export { requiredOnboardingKindCodes };
