"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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
        <Link href="/fleet/partner" className="block">
          <p className="text-sm font-semibold text-zinc-100">Fleet Enterprise</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-widest text-zinc-600">Portal partener</p>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {PARTNER_NAV_ITEMS.map((item) => {
          const active = partnerNavActive(pathname, item.activePrefixes);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMenu}
              className={`mb-0.5 flex items-center justify-between rounded-md py-2 pl-3 pr-2 text-sm transition-colors ${
                active
                  ? "border-l-2 border-violet-500 bg-zinc-900/80 pl-[10px] font-medium text-zinc-100"
                  : "border-l-2 border-transparent text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200"
              }`}
            >
              <span>{item.label}</span>
              {item.badge ? (
                <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
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
          <div className="mx-auto flex min-h-0 w-full max-w-[90rem] flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </div>

        <nav
          className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-4 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur lg:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          aria-label="Navigare partener"
        >
          {PARTNER_NAV_ITEMS.map((item) => {
            const active = partnerNavActive(pathname, item.activePrefixes);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-1 py-2.5 text-center text-[10px] leading-tight ${
                  active ? "text-violet-400" : "text-zinc-500"
                }`}
              >
                {item.label.split(" ")[0]}
              </Link>
            );
          })}
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
