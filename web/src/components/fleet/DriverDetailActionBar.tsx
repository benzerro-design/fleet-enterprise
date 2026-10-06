import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Driver mobile detail chrome (2026):
 * back chevron + title on the left, primary Edit + icon delete on the right.
 * Desktop keeps its own header actions (this bar is lg:hidden).
 */
export function DriverDetailActionBar({
  backHref,
  backLabel = "Înapoi",
  title,
  editHref,
  editLabel = "Editare",
  deleteSlot,
}: {
  backHref: string;
  backLabel?: string;
  title: string;
  editHref?: string;
  editLabel?: string;
  deleteSlot?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 -mx-4 mb-5 border-b border-zinc-800/80 bg-zinc-950/95 px-3 py-2 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <Link
          href={backHref}
          aria-label={backLabel}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-200 ring-1 ring-zinc-800 touch-manipulation active:bg-zinc-900"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
            <path
              fillRule="evenodd"
              d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
              clipRule="evenodd"
            />
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold tracking-tight text-zinc-100">{title}</p>
          <p className="truncate text-[11px] text-zinc-500">{backLabel}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {editHref ? (
            <Link
              href={editHref}
              className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-500 px-4 text-sm font-medium text-zinc-950 touch-manipulation"
            >
              {editLabel}
            </Link>
          ) : null}
          {deleteSlot}
        </div>
      </div>
    </header>
  );
}
