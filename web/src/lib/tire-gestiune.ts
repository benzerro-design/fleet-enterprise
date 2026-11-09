export type TireGestiuneOp = "cazare" | "eliberare" | "transfer" | "casare";

export const TIRE_GESTIUNE_OPS: Array<{ code: TireGestiuneOp; label: string }> = [
  { code: "cazare", label: "Cazare" },
  { code: "eliberare", label: "Eliberare" },
  { code: "transfer", label: "Transfer" },
  { code: "casare", label: "Casare" },
];

export function tireRequestKindLabel(
  kind: string | null | undefined,
  serviceLabel?: string | null,
): string {
  switch (kind) {
    case "cazare":
      return "Cazare";
    case "eliberare":
      return "Eliberare";
    case "transfer":
      return "Transfer";
    case "casare":
      return "Casare";
    case "storage":
      return "Depozitare";
    case "service":
      return "Înlocuire";
    default:
      return serviceLabel?.trim() || "Anvelope";
  }
}

export function tireRequestStatusLabel(status: string): string {
  if (status === "open") return "Deschis";
  if (status === "in_progress") return "În lucru";
  return status;
}
