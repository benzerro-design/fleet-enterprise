import { DOCUMENT_EXPIRING_WITHIN_DAYS } from '../ops/document-types';

export type LicenseExpiryStatus = 'none' | 'valid' | 'expiring' | 'expired';

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addUtcDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

export function licenseExpiryStatus(expiresOn: Date | null | undefined): LicenseExpiryStatus {
  if (!expiresOn) return 'none';
  const today = startOfUtcDay(new Date());
  const exp = startOfUtcDay(expiresOn);
  if (exp.getTime() < today.getTime()) return 'expired';
  const limit = addUtcDays(today, DOCUMENT_EXPIRING_WITHIN_DAYS);
  if (exp.getTime() <= limit.getTime()) return 'expiring';
  return 'valid';
}

export function licenseExpiryWhere(
  filter: 'expiring' | 'expired',
  now = new Date(),
): { gte?: Date; lt?: Date; lte?: Date } {
  const today = startOfUtcDay(now);
  if (filter === 'expired') {
    return { lt: today };
  }
  const until = addUtcDays(today, DOCUMENT_EXPIRING_WITHIN_DAYS);
  return { gte: today, lte: until };
}
