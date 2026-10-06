import Link from "next/link";
import type { ReactNode } from "react";

/** Compact action row for driver mobile detail pages (trip / cost). Desktop keeps its own header actions. */
export function DriverDetailActionBar({
  backHref,
  backLabel = "Înapoi",
  editHref,
  editLabel = "Editare",
  deleteSlot,
}: {
  backHref: string;
  backLabel?: string;
  editHref?: string;
  editLabel?: string;
  deleteSlot?: ReactNode;
}) {
  return (
    <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-zinc-800/80 bg-zinc-950/95 px-4 py-2.5 backdrop-blur-sm lg:hidden">
      <div className="flex items-center gap-2">
        <Link
          href={backHref}
          className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-full bg-zinc-900 px-3 text-sm font-medium text-zinc-200 ring-1 ring-zinc-800 touch-manipulation"
        >
          {backLabel}
        </Link>
        {editHref ? (
          <Link
            href={editHref}
            className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-full bg-emerald-500 px-3 text-sm font-medium text-zinc-950 touch-manipulation"
          >
            {editLabel}
          </Link>
        ) : null}
        {deleteSlot ? <div className="shrink-0">{deleteSlot}</div> : null}
      </div>
    </div>
  );
}
