"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { appendPartnerSupplierQuery, parsePartnerSupplierQuery } from "@/lib/partner-context";
import { useCallback, useEffect, useState } from "react";
import { PartnerNavLinks } from "@/components/fleet/partner/PartnerNavLinks";
import { PartnerTopBar, type PartnerTopBarContext } from "@/components/fleet/partner/PartnerTopBar";
import { PARTNER_NAV_ITEMS, partnerNavActive } from "@/lib/partner-nav";

const PARTNER_PAGE_TITLES: Record<string, string> = {
  "/fleet/partner": "Dashboard",
  "/fleet/partner/work-orders": "Devize & comenzi",
  "/fleet/partner/appointments": "Programator",
  "/fleet/partner/profile": "Profil firmă",
};

function partnerPageTitle(pathname: string): string {
  if (pathname.startsWith("/fleet/partner/work-orders/")) return "Comandă service";
  for (const [prefix, title] of Object.entries(PARTNER_PAGE_TITLES)) {
    if (partnerNavActive(pathname, [prefix])) return title;
  }
  return "Portal partener";
}

type PartnerShellProps = {
  children: React.ReactNode;
  topBar: PartnerTopBarContext;
  supplierFooter?: string;
  authBanner?: React.ReactNode;
};

export function PartnerShell({ children, topBar, supplierFooter, authBanner }: PartnerShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const homeHref = appendPartnerSupplierQuery(
    "/fleet/partner",
    parsePartnerSupplierQuery(Object.fromEntries(searchParams.entries())),
  );
  const pageTitle = partnerPageTitle(pathname);
  const topBarCtx = { ...topBar, pageTitle };

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, closeMenu]);

  const sidebar = (
    <>
      <div className="shrink-0 border-b border-zinc-800 px-4 py-4">
        <Link href={homeHref} className="block">
          <p className="text-sm font-semibold text-zinc-100">Fleet Enterprise</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-widest text-zinc-600">Portal partener</p>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <PartnerNavLinks items={PARTNER_NAV_ITEMS} onNavigate={closeMenu} />
      </nav>
      {supplierFooter ? (
        <div className="shrink-0 border-t border-zinc-800 px-4 py-3 text-[10px] text-zinc-600">
          {supplierFooter}
        </div>
      ) : null}
    </>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-zinc-950">
      <aside className="hidden h-full w-[220px] shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 lg:flex">
        {sidebar}
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {authBanner}

        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950 px-4 py-2.5 lg:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="rounded-lg border border-zinc-800 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            Meniu
          </button>
          <p className="truncate text-sm font-medium text-zinc-200">{pageTitle}</p>
        </header>

        <PartnerTopBar ctx={topBarCtx} />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden pb-[calc(3.25rem+env(safe-area-inset-bottom,0px))] lg:pb-0">
          {/* Scroll pe FleetPageMain (fleet-scroll-pane), ca pe shell-ul flotă — fără overflow dublu. */}
          <div className="mx-auto flex min-h-0 w-full max-w-[90rem] flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </div>

        <nav
          className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-4 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur lg:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          aria-label="Navigare partener"
        >
          <PartnerNavLinks items={PARTNER_NAV_ITEMS} className="grid-cols-4" />
        </nav>
      </div>

      {menuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Închide meniul"
            onClick={closeMenu}
          />
          <div className="absolute bottom-0 left-0 top-0 flex w-[min(100%,280px)] min-h-0 flex-col border-r border-zinc-800 bg-zinc-950 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <p className="text-sm font-semibold text-zinc-100">Meniu</p>
              <button
                type="button"
                onClick={closeMenu}
                className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-900"
              >
                Închide
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">{sidebar}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
