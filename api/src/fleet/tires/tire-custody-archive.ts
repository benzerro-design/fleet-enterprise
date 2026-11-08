import { TireCustodyProtocolStatus } from '@prisma/client';

/** Signed + immutable PDF archive present. */
export function assertTireCustodyArchiveReady(row: {
  status: TireCustodyProtocolStatus | string;
  pdfSha256: string | null;
  pdfBytes: Uint8Array | Buffer | null;
}): { ok: true } | { ok: false; message: string } {
  if (row.status !== TireCustodyProtocolStatus.signed && row.status !== 'signed') {
    return { ok: false, message: 'Protocol must be signed' };
  }
  if (!row.pdfSha256?.trim()) {
    return { ok: false, message: 'Protocol PDF archive hash missing' };
  }
  if (!row.pdfBytes || row.pdfBytes.length === 0) {
    return { ok: false, message: 'Protocol PDF archive bytes missing' };
  }
  return { ok: true };
}

export const TIRE_CUSTODY_MIN_MEDIA = 1;
