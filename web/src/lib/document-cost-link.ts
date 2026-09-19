export function defaultCostCategoryForDocument(documentTypeCode: string): string {
  switch (documentTypeCode) {
    case "rca":
      return "RCA";
    case "casco":
      return "CASCO";
    case "itp_cert":
      return "ITP";
    default:
      return "Altele";
  }
}

export function defaultDocumentTypeForCost(category: string): string {
  const c = category.trim().toLowerCase();
  if (c === "rca") return "rca";
  if (c === "casco") return "casco";
  if (c === "itp") return "itp_cert";
  return "altul";
}
