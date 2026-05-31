/** Stil comun pentru filtrele discrete de pe detaliu vehicul. */
export const vehicleDetailFilterInputClass =
  "min-w-0 rounded border border-zinc-800/80 bg-zinc-950/50 px-2 py-1 text-xs text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700/50";

export const vehicleDetailFilterLabelClass = "text-[10px] uppercase tracking-wide text-zinc-600";

export const vehicleDetailFilterBarClass =
  "mt-3 flex flex-wrap items-end gap-x-3 gap-y-2 rounded-lg border border-zinc-800/50 bg-zinc-950/30 px-3 py-2.5";

function utcDay(iso: string): number {
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00.000Z`);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function matchesDateRange(iso: string | null | undefined, from: string, to: string): boolean {
  if (!from.trim() && !to.trim()) return true;
  if (!iso) return false;
  const t = utcDay(iso);
  if (from.trim() && t < utcDay(from.trim())) return false;
  if (to.trim() && t > utcDay(to.trim())) return false;
  return true;
}

export function matchesText(haystack: string | null | undefined, needle: string): boolean {
  if (!needle.trim()) return true;
  return (haystack ?? "").toLowerCase().includes(needle.trim().toLowerCase());
}
