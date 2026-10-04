"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FleetCommandPalette, type FleetCommandItem } from "@/components/fleet/FleetCommandPalette";
import { FleetHelpRail } from "@/components/fleet/FleetHelpRail";
import { FleetSidebarNav } from "@/components/fleet/FleetSidebarNav";
import { FleetTopBar } from "@/components/fleet/FleetTopBar";
import { useAppearancePrefs } from "@/components/fleet/AppearanceProvider";
import { FLEET_MOBILE_TABS, type FleetMobileTab, type FleetNavGroup } from "@/lib/fleet-nav";
import { readHelpRailOpen, writeHelpRailOpen } from "@/lib/fleet-help-rail";
import { localizeFleetMobileTabs, localizeFleetNavGroup } from "@/lib/i18n/fleet-nav";
import { useT } from "@/lib/i18n/useT";
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
  clientDriverPortal?: boolean;
  mobileTabs?: FleetMobileTab[];
};

function mobileTabActive(pathname: string, prefixes: string[]): boolean {
  if (prefixes.length === 0) return false;
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function commandItemsFromGroups(
  groups: (FleetNavGroup | null | undefined)[],
  tx: (keyPath: string) => string,
): FleetCommandItem[] {
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
    label: tx("common.preferences"),
    href: "/fleet/preferences",
    group: tx("common.account"),
    keywords: "aspect tema densitate",
  });
  out.push({
    id: "/fleet/help",
    label: tx("common.help"),
    href: "/fleet/help",
    group: tx("common.account"),
    keywords: "ajutor documentatie ghid",
  });
  return out;
}

function mobileTitleForPath(
  pathname: string,
  tabs: FleetMobileTab[],
  hrefLabels: Record<string, string>,
): string {
  const activeTab = tabs.find((tab) => !tab.openMenu && mobileTabActive(pathname, tab.activePrefixes));
  if (activeTab) return activeTab.label;

  const match = Object.entries(hrefLabels)
    .filter(([href]) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b[0].length - a[0].length)[0];
  return match?.[1] ?? "Acasă";
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
  clientDriverPortal,
  mobileTabs = FLEET_MOBILE_TABS,
}: FleetShellProps) {
  const { prefs } = useAppearancePrefs();
  const tx = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpRailOpen, setHelpRailOpen] = useState(false);
  const [helpRailHydrated, setHelpRailHydrated] = useState(false);
  const pathname = usePathname() ?? "";
  const localizedGroups = useMemo(
    () => groups.map((group) => localizeFleetNavGroup(prefs.locale, group)),
    [groups, prefs.locale],
  );
  const localizedSetup = useMemo(
    () => (setup ? localizeFleetNavGroup(prefs.locale, setup) : setup),
    [setup, prefs.locale],
  );
  const localizedAdmin = useMemo(
    () => (admin ? localizeFleetNavGroup(prefs.locale, admin) : admin),
    [admin, prefs.locale],
  );
  const localizedBot = useMemo(
    () => (bot ? localizeFleetNavGroup(prefs.locale, bot) : bot),
    [bot, prefs.locale],
  );
  const localizedMobileTabs = useMemo(
    () => {
      const tabs = localizeFleetMobileTabs(prefs.locale, mobileTabs);
      if (!clientDriverPortal) return tabs;
      return tabs.map((tab) => (tab.openMenu ? { ...tab, label: tx("shell.menu") } : tab));
    },
    [clientDriverPortal, mobileTabs, prefs.locale, tx],
  );
  const commandItems = useMemo(
    () => commandItemsFromGroups([...localizedGroups, localizedSetup, localizedAdmin, localizedBot], tx),
    [localizedGroups, localizedSetup, localizedAdmin, localizedBot, tx],
  );
  const allowedHrefs = useMemo(() => commandItems.map((i) => i.href), [commandItems]);
  const hrefLabels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of commandItems) map[item.href] = item.label;
    return map;
  }, [commandItems]);
  const mobileTitle = clientDriverPortal
    ? mobileTitleForPath(pathname, localizedMobileTabs, hrefLabels)
    : "Fleet";

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const toggleHelpRail = useCallback(() => setHelpRailOpen((v) => !v), []);

  useEffect(() => {
    setHelpRailOpen(readHelpRailOpen());
    setHelpRailHydrated(true);
  }, []);

  useEffect(() => {
    if (!helpRailHydrated) return;
    writeHelpRailOpen(helpRailOpen);
  }, [helpRailOpen, helpRailHydrated]);

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
    <div data-fleet-shell className="fleet-chrome flex h-dvh max-h-dvh overflow-hidden print:h-auto print:max-h-none print:overflow-visible">
      <FleetCommandPalette items={commandItems} />
      {/* Desktop sidebar — chrome BO */}
      <aside className="fleet-chrome hidden h-full w-[260px] shrink-0 flex-col border-r border-zinc-800 print:hidden lg:flex">
        <div className="shrink-0 border-b border-zinc-800 px-4 py-4">
          <Link href={homeHref} className="block">
            <p className="text-sm font-semibold text-zinc-100">Fleet Enterprise</p>
            {tenantSlug ? (
              <p className="mt-0.5 font-mono text-xs text-zinc-500">tenant: {tenantSlug}</p>
            ) : null}
          </Link>
        </div>
        <FleetSidebarNav
          groups={localizedGroups}
          setup={localizedSetup}
          admin={localizedAdmin}
          bot={localizedBot}
          variant="desktop"
        />
        <div className="shrink-0 border-t border-zinc-800 px-4 py-3">
          {userEmail ? <p className="truncate text-xs text-zinc-500">{userEmail}</p> : null}
          {readOnly ? (
            <p className="mt-1 text-[10px] uppercase tracking-wide text-zinc-600">{tx("common.readOnly")}</p>
          ) : null}
          <div className="mt-2 space-y-1.5">
            <Link
              href="/fleet/preferences"
              className="block text-xs font-medium text-sky-400 hover:text-sky-300 hover:underline"
            >
              {tx("common.preferences")}
            </Link>
            <p className="text-[10px] text-zinc-600">{tx("shell.commandHint")}</p>
            <LogoutButton />
          </div>
        </div>
      </aside>

      <div className="fleet-canvas flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {authBanner}

        <FleetTopBar
          userEmail={userEmail}
          allowedHrefs={allowedHrefs}
          hrefLabels={hrefLabels}
          helpRailOpen={helpRailOpen}
          onToggleHelpRail={toggleHelpRail}
        />

        {/* Mobile top bar — fix deasupra zonei scrollabile */}
        <header className="fleet-chrome z-30 flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3 print:hidden lg:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="rounded-lg border border-zinc-800 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
            aria-expanded={menuOpen}
            aria-controls="fleet-mobile-drawer"
          >
            {tx("shell.menu")}
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-medium text-zinc-200">{mobileTitle}</p>
            {tenantSlug ? (
              <p className="truncate font-mono text-[10px] text-zinc-600">{tenantSlug}</p>
            ) : null}
          </div>
          <LogoutButton />
        </header>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] print:overflow-visible print:pb-0 lg:pb-0">
            <div
              className="mx-auto flex min-h-0 w-full max-w-[90rem] flex-1 flex-col px-4 sm:px-6 lg:px-8"
              style={{
                paddingTop: "var(--fleet-pad-y)",
                paddingBottom: "var(--fleet-pad-y)",
                paddingLeft: "max(1rem, var(--fleet-pad-x))",
                paddingRight: "max(1rem, var(--fleet-pad-x))",
              }}
            >
              {children}
            </div>
          </div>
          <FleetHelpRail open={helpRailOpen} onClose={() => setHelpRailOpen(false)} />
        </div>

        {/* Mobile bottom bar */}
        <nav
          className="fleet-chrome fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t border-zinc-800/95 print:hidden lg:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          aria-label={tx("nav.aria.quick")}
        >
          {localizedMobileTabs.map((tab) => {
            const active = tab.openMenu ? menuOpen : mobileTabActive(pathname, tab.activePrefixes);
            if (tab.openMenu) {
              return (
                <button
                  key={tab.label}
                  type="button"
                  onClick={() => setMenuOpen(true)}
                  className={`min-h-[44px] touch-manipulation px-1 py-3 text-center text-[11px] leading-tight ${
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
                className={`min-h-[44px] touch-manipulation px-1 py-3 text-center text-[11px] leading-tight ${
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
            aria-label={tx("shell.closeMenu")}
            onClick={closeMenu}
          />
          <div
            id="fleet-mobile-drawer"
            className="fleet-chrome absolute bottom-0 left-0 top-0 flex w-[min(100%,320px)] min-h-0 flex-col border-r border-zinc-800 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-zinc-100">{tx("shell.menu")}</p>
                {tenantSlug ? (
                  <p className="font-mono text-xs text-zinc-500">{tenantSlug}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={closeMenu}
                className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              >
                {tx("common.close")}
              </button>
            </div>
            <FleetSidebarNav
              groups={localizedGroups}
              setup={localizedSetup}
              admin={localizedAdmin}
              bot={localizedBot}
              variant="drawer"
              onNavigate={closeMenu}
            />
            <div className="border-t border-zinc-800 px-4 py-3">
              {userEmail ? <p className="truncate text-xs text-zinc-500">{userEmail}</p> : null}
              {readOnly ? (
                <p className="mt-1 text-[10px] uppercase tracking-wide text-zinc-600">{tx("common.readOnly")}</p>
              ) : null}
              <Link
                href="/fleet/preferences"
                onClick={closeMenu}
                className="mt-2 block text-xs font-medium text-sky-400 hover:underline"
              >
                {tx("common.preferences")}
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
