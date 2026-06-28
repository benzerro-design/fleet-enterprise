export const CLIENT_DOCUMENT_TYPE_OPTIONS = [
  { code: "cui", label: "CUI / Certificat fiscal" },
  { code: "certificat_inregistrare", label: "Certificat înregistrare" },
  { code: "autorizatie", label: "Autorizație" },
  { code: "contract", label: "Contract" },
  { code: "altele", label: "Altele" },
] as const;

export type ClientDocumentTypeCode = (typeof CLIENT_DOCUMENT_TYPE_OPTIONS)[number]["code"];

export function clientDocumentTypeLabel(code: string): string {
  return CLIENT_DOCUMENT_TYPE_OPTIONS.find((o) => o.code === code)?.label ?? code;
}
