import Link from "next/link";
import { t } from "@/lib/i18n/t";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/types";

type Props = {
  title: string;
  description?: string;
  /** Filtre active — mesaj diferit față de listă goală total. */
  hasFilters?: boolean;
  clearFiltersHref?: string;
  primaryAction?: { label: string; href: string };
  locale?: Locale;
};

/** Empty state Index (listă) — CTA clar, fără carduri decorative. */
export function FleetListEmptyState({
  title,
  description,
  hasFilters,
  clearFiltersHref,
  primaryAction,
  locale = DEFAULT_LOCALE,
}: Props) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-zinc-700 bg-zinc-950/40 px-5 py-10">
      <div>
        <p className="text-sm font-medium text-zinc-200">{title}</p>
        {description ? <p className="mt-1 max-w-md text-sm text-zinc-500">{description}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {hasFilters && clearFiltersHref ? (
          <Link
            href={clearFiltersHref}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            {t(locale, "common.list.clearFilters")}
          </Link>
        ) : null}
        {primaryAction ? (
          <Link
            href={primaryAction.href}
            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
          >
            {primaryAction.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
