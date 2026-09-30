"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LogoutButton } from "@/app/fleet/logout-button";
import { openFleetCommandPalette } from "@/components/fleet/FleetCommandPalette";
import { TicketNotificationBell } from "@/components/fleet/tickets/TicketNotificationBell";
import {
  FLEET_NAV_FAVORITES_MAX,
  favoriteHrefFromPath,
  readFleetNavFavorites,
  writeFleetNavFavorites,
  type FleetNavFavorite,
} from "@/lib/fleet-nav-favorites";

type Props = {
  userEmail?: string;
  /** Href-uri live din nav — scorcuturile se filtrează după ele. */
  allowedHrefs?: string[];
  /** Catalog label per href (din Cmd+K / nav). */
  hrefLabels?: Record<string, string>;
  helpRailOpen?: boolean;
  onToggleHelpRail?: () => void;
};

function userInitials(email?: string): string {
  if (!email) return "?";
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return local.slice(0, 2).toUpperCase() || "?";
}

function labelForHref(href: string, hrefLabels?: Record<string, string>): string {
  if (hrefLabels?.[href]) return hrefLabels[href]!;
  const last = href.split("/").filter(Boolean).pop() ?? href;
  return last.replace(/-/g, " ");
}

export function FleetTopBar({
  userEmail,
  allowedHrefs,
  hrefLabels,
  helpRailOpen,
  onToggleHelpRail,
}: Props) {
  const pathname = usePathname() ?? "";
  const [menuOpen, setMenuOpen] = useState(false);
  const [favorites, setFavorites] = useState<FleetNavFavorite[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const initials = userInitials(userEmail);

  useEffect(() => {
    setFavorites(readFleetNavFavorites());
    setHydrated(true);
  }, []);

  const allowedSet = useMemo(
    () => (allowedHrefs?.length ? new Set(allowedHrefs) : null),
    [allowedHrefs],
  );

  const shortcuts = useMemo(() => {
    const list = favorites.filter((f) => !allowedSet || allowedSet.has(f.href));
    return list.slice(0, FLEET_NAV_FAVORITES_MAX);
  }, [favorites, allowedSet]);

  const currentFavoriteHref = favoriteHrefFromPath(pathname);
  const canFavorite =
    !!currentFavoriteHref && (!allowedSet || allowedSet.has(currentFavoriteHref));
  const isFavorite =
    !!currentFavoriteHref && favorites.some((f) => f.href === currentFavoriteHref);

  const toggleFavorite = useCallback(() => {
    if (!currentFavoriteHref || !canFavorite) return;
    setFavorites((prev) => {
      const exists = prev.some((f) => f.href === currentFavoriteHref);
      let next: FleetNavFavorite[];
      if (exists) {
        next = prev.filter((f) => f.href !== currentFavoriteHref);
      } else {
        const label = labelForHref(currentFavoriteHref, hrefLabels);
        next = [{ href: currentFavoriteHref, label }, ...prev.filter((f) => f.href !== currentFavoriteHref)];
        next = next.slice(0, FLEET_NAV_FAVORITES_MAX);
      }
      writeFleetNavFavorites(next);
      return next;
    });
  }, [canFavorite, currentFavoriteHref, hrefLabels]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <header className="fleet-chrome hidden h-11 shrink-0 items-center justify-between gap-3 border-b border-zinc-800 px-4 print:hidden lg:flex lg:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <button
          type="button"
          onClick={() => openFleetCommandPalette()}
          className="flex min-w-0 max-w-sm flex-1 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-left text-xs text-zinc-500 hover:border-zinc-700 hover:bg-zinc-900"
          aria-label="Căutare rapidă"
        >
          <span className="truncate">Caută pagină sau acțiune…</span>
          <kbd className="ml-auto hidden shrink-0 rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 sm:inline">
            Ctrl+K
          </kbd>
        </button>
        {hydrated && shortcuts.length > 0 ? (
          <nav className="hidden items-center gap-1 xl:flex" aria-label="Favorite">
            {shortcuts.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="rounded-md px-2 py-1 text-[11px] font-medium text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
              >
                {s.label}
              </Link>
            ))}
          </nav>
        ) : null}
        {hydrated && canFavorite ? (
          <button
            type="button"
            onClick={toggleFavorite}
            className={`hidden rounded-md border px-2 py-1 text-[11px] xl:inline ${
              isFavorite
                ? "border-amber-700/60 bg-amber-950/40 text-amber-200"
                : "border-zinc-800 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
            }`}
            title={isFavorite ? "Scoate din favorite" : "Adaugă la favorite (max 5)"}
            aria-pressed={isFavorite}
          >
            {isFavorite ? "★ Favorit" : "☆ Favorit"}
          </button>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {onToggleHelpRail ? (
          <button
            type="button"
            onClick={onToggleHelpRail}
            className={`hidden rounded-md border px-2 py-1 text-[11px] font-medium xl:inline ${
              helpRailOpen
                ? "border-sky-700/50 bg-sky-950/40 text-sky-200"
                : "border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
            }`}
            aria-pressed={!!helpRailOpen}
            title="Ajutor contextual pe ecran"
          >
            Help
          </button>
        ) : null}
        <TicketNotificationBell />
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border border-zinc-800 px-1.5 py-1 hover:bg-zinc-900"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label="Cont"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-950 text-[10px] font-semibold text-emerald-200">
              {initials}
            </span>
            {userEmail ? (
              <span className="hidden max-w-[10rem] truncate text-[11px] text-zinc-400 2xl:inline">
                {userEmail}
              </span>
            ) : null}
            <span className="text-[8px] text-zinc-500">▾</span>
          </button>
          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border border-zinc-800 bg-zinc-950 py-1 shadow-xl"
            >
              {userEmail ? (
                <div className="border-b border-zinc-800 px-3 py-2">
                  <p className="truncate text-xs font-medium text-zinc-200">{userEmail}</p>
                </div>
              ) : null}
              <div className="space-y-2 px-3 py-2">
                <Link
                  href="/fleet/preferences"
                  className="block text-xs font-medium text-sky-400 hover:underline"
                  onClick={() => setMenuOpen(false)}
                >
                  Preferințe
                </Link>
                <Link
                  href="/fleet/help"
                  className="block text-xs text-zinc-400 hover:text-zinc-200 hover:underline"
                  onClick={() => setMenuOpen(false)}
                >
                  Catalog Help
                </Link>
                <LogoutButton />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
