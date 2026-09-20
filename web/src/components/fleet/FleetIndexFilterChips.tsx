import Link from "next/link";

export type FleetIndexFilterChip = {
  key: string;
  label: string;
  /** Href fără acest filtru (sau reset total). */
  clearHref: string;
};

type Props = {
  chips: FleetIndexFilterChip[];
  resetHref: string;
};

/** Chip-uri filtre active (stil Index) — sticky pe bara de filtre. */
export function FleetIndexFilterChips({ chips, resetHref }: Props) {
  if (chips.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-800/80 pt-3">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">Active</span>
      {chips.map((c) => (
        <Link
          key={c.key}
          href={c.clearHref}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
          title="Elimină filtrul"
        >
          <span>{c.label}</span>
          <span className="text-zinc-600" aria-hidden>
            ×
          </span>
        </Link>
      ))}
      <Link href={resetHref} className="text-[11px] text-sky-400 hover:underline">
        Resetează tot
      </Link>
    </div>
  );
}
