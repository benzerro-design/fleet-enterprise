"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { helpArticleForPath } from "@/lib/fleet-help-rail";
import { fleetScrollPaneClass } from "@/lib/fleet-scroll-styles";

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * PLAT-007 — rail Help contextual (spirit PrestaShop help sidebar).
 * Doar pe FleetShell desktop; partner neschimbat.
 */
export function FleetHelpRail({ open, onClose }: Props) {
  const pathname = usePathname() ?? "";
  const article = helpArticleForPath(pathname);

  if (!open) return null;

  const bullets = article?.sections[0]?.body.slice(0, 3) ?? [];

  return (
    <aside
      className="fleet-chrome hidden w-[280px] shrink-0 flex-col border-l border-zinc-800 print:hidden xl:flex"
      aria-label="Ajutor contextual"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Help</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
          aria-label="Închide ajutorul"
        >
          Închide
        </button>
      </div>
      <div className={`${fleetScrollPaneClass} flex min-h-0 flex-1 flex-col gap-3 p-3`}>
        {article ? (
          <>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">{article.title}</h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">{article.summary}</p>
            </div>
            {bullets.length > 0 ? (
              <ul className="list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-zinc-400">
                {bullets.map((b) => (
                  <li key={b.slice(0, 48)}>{b}</li>
                ))}
              </ul>
            ) : null}
            <div className="mt-auto space-y-2 border-t border-zinc-800 pt-3">
              <Link
                href={`/fleet/help/${article.slug}`}
                className="block text-xs font-medium text-sky-400 hover:underline"
              >
                Citește articolul →
              </Link>
              <Link href="/fleet/help" className="block text-xs text-zinc-500 hover:text-zinc-300">
                Catalog Help
              </Link>
              {article.relatedHrefs?.slice(0, 2).map((r) => (
                <Link
                  key={r.href}
                  href={r.href}
                  className="block text-xs text-zinc-500 hover:text-zinc-300"
                >
                  {r.label}
                </Link>
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs text-zinc-500">Niciun articol pentru această pagină.</p>
        )}
      </div>
    </aside>
  );
}
