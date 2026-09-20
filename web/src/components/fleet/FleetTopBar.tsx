"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { LogoutButton } from "@/app/fleet/logout-button";
import { openFleetCommandPalette } from "@/components/fleet/FleetCommandPalette";
import { TicketNotificationBell } from "@/components/fleet/tickets/TicketNotificationBell";

const SHORTCUT_CANDIDATES = [
  { label: "Tichete", href: "/fleet/tickets" },
  { label: "Programator", href: "/fleet/scheduler" },
  { label: "Devize", href: "/fleet/work-orders" },
] as const;

type Props = {
  userEmail?: string;
  /** Href-uri live din nav — scorcuturile se filtrează după ele. */
  allowedHrefs?: string[];
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

export function FleetTopBar({ userEmail, allowedHrefs }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const initials = userInitials(userEmail);

  const shortcuts = useMemo(() => {
    if (!allowedHrefs?.length) return [...SHORTCUT_CANDIDATES];
    const set = new Set(allowedHrefs);
    return SHORTCUT_CANDIDATES.filter((s) => set.has(s.href));
  }, [allowedHrefs]);

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
    <header className="hidden h-11 shrink-0 items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950/95 px-4 print:hidden lg:flex lg:px-6">
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
        {shortcuts.length > 0 ? (
          <nav className="hidden items-center gap-1 xl:flex" aria-label="Scurtături">
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
      </div>

      <div className="flex shrink-0 items-center gap-2">
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
              <span className="hidden max-w-[10rem] truncate text-[11px] text-zinc-400 2xl:inline">{userEmail}</span>
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
                <LogoutButton />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
