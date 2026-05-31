/** Aliniat cu `DOCUMENT_EXPIRING_WITHIN_DAYS` din API. */
export const DOCUMENT_EXPIRING_WITHIN_DAYS = 30;

export type DocumentExpiryUiStatus = "none" | "valid" | "expiring" | "expired";

export function documentExpiryStatus(expiresOn: string | null): DocumentExpiryUiStatus {
  if (!expiresOn) return "none";
  const today = startOfUtcDay(new Date());
  const exp = startOfUtcDay(new Date(expiresOn));
  if (exp.getTime() < today.getTime()) return "expired";
  const limit = new Date(today);
  limit.setUTCDate(limit.getUTCDate() + DOCUMENT_EXPIRING_WITHIN_DAYS);
  if (exp.getTime() <= limit.getTime()) return "expiring";
  return "valid";
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function documentExpiryBadge(status: DocumentExpiryUiStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case "expired":
      return {
        label: "Expirat",
        className: "border-red-900/60 bg-red-950/50 text-red-200",
      };
    case "expiring":
      return {
        label: "Expiră curând",
        className: "border-amber-900/60 bg-amber-950/50 text-amber-200",
      };
    case "valid":
      return {
        label: "Valabil",
        className: "border-emerald-900/60 bg-emerald-950/50 text-emerald-200",
      };
    default:
      return {
        label: "Fără expirare",
        className: "border-zinc-700 bg-zinc-900/60 text-zinc-400",
      };
  }
}
