/** Tipuri document vehicul (Phase 1 — aliniat cu scope RCA/CASCO/CIV). */
export const DOCUMENT_TYPE_CODES = [
  'rca',
  'casco',
  'cert_inmatriculare',
  'civ',
  'civ_fata',
  'civ_verso',
  'itp_cert',
  'licenta_transport',
  'altul',
] as const;

export type DocumentTypeCode = (typeof DOCUMENT_TYPE_CODES)[number];

export function isDocumentTypeCode(v: string): v is DocumentTypeCode {
  return (DOCUMENT_TYPE_CODES as readonly string[]).includes(v);
}

export function isCivDocumentTypeCode(code: string): boolean {
  return code === 'civ' || code === 'civ_fata' || code === 'civ_verso';
}

/** Zile înainte de expirare pentru status „expiră curând”. */
export const DOCUMENT_EXPIRING_WITHIN_DAYS = 30;
