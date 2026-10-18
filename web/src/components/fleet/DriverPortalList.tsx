import Link from "next/link";
import { fleetDriverViewTabClass } from "@/lib/fleet-list-chrome";

export type DriverStatusItem = {
  href: string;
  label: string;
  active: boolean;
};

export type DriverRecordItem = {
  href: string;
  title: string;
  meta: string;
  badge?: string;
};

/** Tab-uri de view (underline) — distincte de butoanele tool tip Filtre. */
export function DriverStatusBand({ items }: { items: DriverStatusItem[] }) {
  return (
    <nav className="sticky top-0 z-10 flex min-w-0 gap-1 overflow-x-auto border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-sm">
      {items.map((item) => (
        <Link
          key={item.href + item.label}
          href={item.href}
          className={fleetDriverViewTabClass(item.active)}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function DriverRecordList({ items, empty }: { items: DriverRecordItem[]; empty: string }) {
  if (items.length === 0) {
    return <p className="py-8 text-sm text-zinc-500">{empty}</p>;
  }
  return (
    <ul>
      {items.map((item) => (
        <li key={item.href} className="border-b border-zinc-800/80">
          <Link href={item.href} className="flex min-h-[64px] items-center justify-between gap-3 py-3.5">
            <span className="min-w-0">
              <span className="block truncate text-base font-medium text-zinc-100">{item.title}</span>
              <span className="mt-0.5 block truncate text-sm text-zinc-500">{item.meta}</span>
            </span>
            {item.badge ? <span className="shrink-0 text-xs text-zinc-400">{item.badge}</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function DriverPager({
  page,
  totalPages,
  prevHref,
  nextHref,
  prevLabel,
  nextLabel,
}: {
  page: number;
  totalPages: number;
  prevHref: string | null;
  nextHref: string | null;
  prevLabel: string;
  nextLabel: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-4 text-sm">
      {prevHref ? (
        <Link href={prevHref} className="text-zinc-200">
          {prevLabel}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-zinc-500">
        {page} / {totalPages}
      </span>
      {nextHref ? (
        <Link href={nextHref} className="text-zinc-200">
          {nextLabel}
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
