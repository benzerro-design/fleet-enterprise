export const DRIVER_DOCUMENT_TYPE_OPTIONS = [
  { code: "permis", label: "Permis de conducere" },
  { code: "adr", label: "Certificat ADR" },
  { code: "medicina_muncii", label: "Medicina muncii" },
  { code: "atestat", label: "Atestat profesional" },
  { code: "altele", label: "Altele" },
] as const;

export type DriverDocumentTypeCode = (typeof DRIVER_DOCUMENT_TYPE_OPTIONS)[number]["code"];

export function driverDocumentTypeLabel(code: string): string {
  return DRIVER_DOCUMENT_TYPE_OPTIONS.find((o) => o.code === code)?.label ?? code;
}
