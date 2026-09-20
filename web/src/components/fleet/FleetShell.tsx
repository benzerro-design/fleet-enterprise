"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FleetCommandPalette, type FleetCommandItem } from "@/components/fleet/FleetCommandPalette";
import { FleetSidebarNav } from "@/components/fleet/FleetSidebarNav";
import { FLEET_MOBILE_TABS, type FleetMobileTab, type FleetNavGroup } from "@/lib/fleet-nav";
import { LogoutButton } from "@/app/fleet/logout-button";

type FleetShellProps = {
  children: React.ReactNode;
  groups: FleetNavGroup[];
  setup?: FleetNavGroup | null;
  admin: FleetNavGroup | null;
  bot?: FleetNavGroup | null;
  tenantSlug?: string;
  userEmail?: string;
  readOnly?: boolean;
  authBanner?: React.ReactNode;
  homeHref?: string;
  mobileTabs?: FleetMobileTab[];
};

function mobileTabActive(pathname: string, prefixes: string[]): boolean {
  if (prefixes.length === 0) return false;
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function commandItemsFromGroups(groups: (FleetNavGroup | null | undefined)[]): FleetCommandItem[] {
  const out: FleetCommandItem[] = [];
  for (const group of groups) {
    if (!group) continue;
    for (const item of group.items) {
      if (item.kind !== "link") continue;
      out.push({
        id: item.href,
        label: item.label,
        href: item.href,
        group: group.label,
      });
    }
  }
  out.push({
    id: "/fleet/preferences",
    label: "Preferințe",
    href: "/fleet/preferences",
    group: "Cont",
    keywords: "aspect tema densitate",
  });
  return out;
}

export function FleetShell({
  children,
  groups,
  setup,
  admin,
  bot,
  tenantSlug,
  userEmail,
  readOnly,
  authBanner,
  homeHref = "/fleet/dashboard",
  mobileTabs = FLEET_MOBILE_TABS,
}: FleetShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname() ?? "";
  const commandItems = useMemo(
    () => commandItemsFromGroups([...groups, setup, admin, bot]),
    [groups, setup, admin, bot],
  );

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen, closeMenu]);

  return (
    <div data-fleet-shell className="flex h-dvh max-h-dvh overflow-hidden bg-zinc-950 print:h-auto print:max-h-none print:overflow-visible">
      <FleetCommandPalette items={commandItems} />
      {/* Desktop sidebar */}
      <aside className="hidden h-full w-[260px] shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 print:hidden lg:flex">
        <div className="shrink-0 border-b border-zinc-800 px-4 py-4">
          <Link href={homeHref} className="block">
            <p className="text-sm font-semibold text-zinc-100">Fleet Enterprise</p>
            {tenantSlug ? (
              <p className="mt-0.5 font-mono text-xs text-zinc-500">tenant: {tenantSlug}</p>
            ) : null}
          </Link>
        </div>
        <FleetSidebarNav groups={groups} setup={setup} admin={admin} bot={bot} variant="desktop" />
        <div className="shrink-0 border-t border-zinc-800 px-4 py-3">
          {userEmail ? <p className="truncate text-xs text-zinc-500">{userEmail}</p> : null}
          {readOnly ? (
            <p className="mt-1 text-[10px] uppercase tracking-wide text-zinc-600">Doar citire</p>
          ) : null}
          <div className="mt-2 space-y-1.5">
            <Link
              href="/fleet/preferences"
              className="block text-xs font-medium text-sky-400 hover:text-sky-300 hover:underline"
            >
              Preferințe
            </Link>
            <p className="text-[10px] text-zinc-600">Ctrl/Cmd+K — navigare rapidă</p>
            <LogoutButton />
          </div>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {authBanner}

        {/* Mobile top bar — fix deasupra zonei scrollabile */}
        <header className="z-30 flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950 px-4 py-3 print:hidden lg:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="rounded-lg border border-zinc-800 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
            aria-expanded={menuOpen}
            aria-controls="fleet-mobile-drawer"
          >
            Meniu
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-medium text-zinc-200">Fleet</p>
            {tenantSlug ? (
              <p className="truncate font-mono text-[10px] text-zinc-600">{tenantSlug}</p>
            ) : null}
          </div>
          <LogoutButton />
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] print:overflow-visible print:pb-0 lg:pb-0">
          <div className="mx-auto flex min-h-0 w-full max-w-[90rem] flex-1 flex-col px-4 sm:px-6 lg:px-8" style={{ paddingTop: "var(--fleet-pad-y)", paddingBottom: "var(--fleet-pad-y)" }}>
            {children}
          </div>
        </div>

        {/* Mobile bottom bar */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur print:hidden lg:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          aria-label="Navigare rapidă"
        >
          {mobileTabs.map((tab) => {
            const active = tab.openMenu ? menuOpen : mobileTabActive(pathname, tab.activePrefixes);
            if (tab.openMenu) {
              return (
                <button
                  key={tab.label}
                  type="button"
                  onClick={() => setMenuOpen(true)}
                  className={`px-1 py-2.5 text-center text-[10px] leading-tight ${
                    active ? "text-emerald-400" : "text-zinc-500"
                  }`}
                >
                  {tab.label}
                </button>
              );
            }
            return (
              <Link
                key={tab.label}
                href={tab.href}
                className={`px-1 py-2.5 text-center text-[10px] leading-tight ${
                  active ? "text-emerald-400" : "text-zinc-500"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Mobile drawer */}
      {menuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Închide meniul"
            onClick={closeMenu}
          />
          <div
            id="fleet-mobile-drawer"
            className="absolute bottom-0 left-0 top-0 flex w-[min(100%,320px)] min-h-0 flex-col border-r border-zinc-800 bg-zinc-950 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-zinc-100">Meniu</p>
                {tenantSlug ? (
                  <p className="font-mono text-xs text-zinc-500">{tenantSlug}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={closeMenu}
                className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              >
                Închide
              </button>
            </div>
            <FleetSidebarNav groups={groups} setup={setup} admin={admin} bot={bot} variant="drawer" onNavigate={closeMenu} />
            <div className="border-t border-zinc-800 px-4 py-3">
              {userEmail ? <p className="truncate text-xs text-zinc-500">{userEmail}</p> : null}
              {readOnly ? (
                <p className="mt-1 text-[10px] uppercase tracking-wide text-zinc-600">Doar citire</p>
              ) : null}
              <Link
                href="/fleet/preferences"
                onClick={closeMenu}
                className="mt-2 block text-xs font-medium text-sky-400 hover:underline"
              >
                Preferințe
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
