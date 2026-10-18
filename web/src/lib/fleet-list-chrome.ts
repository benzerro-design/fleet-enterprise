/**
 * Stiluri UI partajate pentru liste: tab-uri (navigare) vs buton filtre (tool).
 * Doar prezentare — fără logică.
 */

/** Tab-uri de view (underline) — nu arată ca butoane pline. */
export function fleetListTabClass(active: boolean): string {
  return `inline-flex min-h-[40px] items-center border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
    active
      ? "border-emerald-400 text-emerald-300"
      : "border-transparent text-zinc-500 hover:border-zinc-700 hover:text-zinc-200"
  }`;
}

/** Buton tool „Filtre” — outline, clar diferit de tab. */
export const fleetListFilterToggleClass =
  "inline-flex min-h-[40px] flex-1 touch-manipulation items-center justify-between gap-3 rounded-md border border-zinc-700/80 bg-zinc-950 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-900 lg:flex-none";

/** Bandă status tip tab pe portal șofer — underline, nu pill ca filtrele. */
export function fleetDriverViewTabClass(active: boolean): string {
  return `inline-flex min-h-[44px] items-center border-b-2 px-3 py-2 text-sm font-medium touch-manipulation ${
    active
      ? "border-emerald-400 text-emerald-300"
      : "border-transparent text-zinc-500 hover:text-zinc-200"
  }`;
}
