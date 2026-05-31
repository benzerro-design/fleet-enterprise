export const DOCUMENT_TYPE_OPTIONS = [
  { value: "rca", label: "RCA" },
  { value: "casco", label: "CASCO" },
  { value: "cert_inmatriculare", label: "Certificat înmatriculare" },
  { value: "civ", label: "CIV" },
  { value: "itp_cert", label: "Certificat ITP" },
  { value: "licenta_transport", label: "Licență transport" },
  { value: "altul", label: "Alt document" },
] as const;

export type DocumentTypeValue = (typeof DOCUMENT_TYPE_OPTIONS)[number]["value"];

export function documentTypeLabel(code: string | null | undefined): string {
  if (!code) return "—";
  const row = DOCUMENT_TYPE_OPTIONS.find((x) => x.value === code);
  return row?.label ?? code;
}

export const DOCUMENT_EXPIRY_STATUS_OPTIONS = [
  { value: "", label: "Toate" },
  { value: "expired", label: "Expirate" },
  { value: "expiring", label: "Expiră în 30 zile" },
  { value: "valid", label: "Valabile" },
  { value: "none", label: "Fără dată expirare" },
] as const;
