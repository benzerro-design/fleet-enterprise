"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { fleetScrollPaneClass } from "@/lib/fleet-scroll-styles";
import {
  type FleetNavEntry,
  type FleetNavGroup,
  navEntryIsActive,
  phaseBadgeLabel,
  type FleetNavLink,
} from "@/lib/fleet-nav";
import { useT } from "@/lib/i18n/useT";

const NAV_OPEN_STORAGE_KEY = "fleet-nav-group-open-v1";

function PhaseBadge({ phase }: { phase: "phase1" | "phase2" | "later" }) {
  const label = phaseBadgeLabel(phase);
  const tone =
    phase === "phase1"
      ? "border-sky-800/60 bg-sky-950/50 text-sky-300"
      : phase === "phase2"
        ? "border-amber-800/60 bg-amber-950/40 text-amber-200"
        : "border-zinc-700 bg-zinc-900/60 text-zinc-500";
  return (
    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tone}`}>
      {label}
    </span>
  );
}

function NavLinkItem({
  entry,
  pathname,
  onNavigate,
  accent,
}: {
  entry: FleetNavLink;
  pathname: string;
  onNavigate?: () => void;
  accent?: "bot";
}) {
  const active = navEntryIsActive(pathname, entry);
  const botIdle =
    accent === "bot"
      ? "border-transparent text-emerald-400/90 hover:bg-emerald-950/30 hover:text-emerald-300"
      : "border-transparent text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200";
  const botActive =
    accent === "bot"
      ? "border-emerald-400 bg-emerald-950/40 font-medium text-emerald-200"
      : "border-emerald-500 bg-zinc-900/80 font-medium text-zinc-100";
  return (
    <Link
      href={entry.href}
      onClick={onNavigate}
      className={`flex items-center justify-between gap-2 rounded-md border-l-2 py-2 pl-3 pr-2 text-sm transition-colors ${
        active ? `${botActive} pl-[10px]` : botIdle
      }`}
    >
      <span>{entry.label}</span>
    </Link>
  );
}

function NavSoonItem({ entry }: { entry: Extract<FleetNavEntry, { kind: "soon" }> }) {
  const tx = useT();
  return (
    <div
      className="flex cursor-not-allowed items-center justify-between gap-2 rounded-md border-l-2 border-transparent py-2 pl-3 pr-2 text-sm text-zinc-600"
      title={entry.hint ?? tx("nav.phaseHint")}
    >
      <span>{entry.label}</span>
      <PhaseBadge phase={entry.phase} />
    </div>
  );
}

function readStoredOpen(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(NAV_OPEN_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, boolean>;
  } catch {
    return {};
  }
}

function NavGroupBlock({
  group,
  pathname,
  onNavigate,
}: {
  group: FleetNavGroup;
  pathname: string;
  onNavigate?: () => void;
}) {
  const hasActive = group.items.some(
    (e) => e.kind === "link" && navEntryIsActive(pathname, e),
  );
  const isBot = group.id === "bot";
  const [open, setOpen] = useState(() => hasActive || group.sidebarSection === "configurare");

  useEffect(() => {
    const stored = readStoredOpen();
    if (typeof stored[group.id] === "boolean") {
      setOpen(stored[group.id]!);
    }
  }, [group.id]);

  const onToggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      try {
        const stored = readStoredOpen();
        stored[group.id] = next;
        window.localStorage.setItem(NAV_OPEN_STORAGE_KEY, JSON.stringify(stored));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [group.id]);

  const summaryTone = isBot
    ? "text-emerald-400 hover:bg-emerald-950/25 hover:text-emerald-300"
    : "text-zinc-300 hover:bg-zinc-900/40";

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`flex w-full cursor-pointer list-none items-center justify-between rounded-md px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-widest transition-colors ${summaryTone}`}
      >
        <span className={isBot ? "tracking-[0.2em]" : undefined}>{group.label}</span>
        <span
          className={`text-xs transition-transform ${open ? "rotate-180" : ""} ${
            isBot ? "text-emerald-600" : "text-zinc-600"
          }`}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {open ? (
        <ul className="space-y-0.5 pb-2 pt-0.5">
          {group.items.map((entry) => (
            <li key={entry.label}>
              {entry.kind === "link" ? (
                <NavLinkItem
                  entry={entry}
                  pathname={pathname}
                  onNavigate={onNavigate}
                  accent={isBot ? "bot" : undefined}
                />
              ) : (
                <NavSoonItem entry={entry} />
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SidebarSectionLabel({ label }: { label: string }) {
  return (
    <p className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 first:pt-0 lg:pt-4">
      {label}
    </p>
  );
}

function renderNavGroups(
  navGroups: FleetNavGroup[],
  pathname: string,
  onNavigate?: () => void,
) {
  return navGroups.map((group) => (
    <NavGroupBlock key={group.id} group={group} pathname={pathname} onNavigate={onNavigate} />
  ));
}

type FleetSidebarNavProps = {
  groups: FleetNavGroup[];
  setup?: FleetNavGroup | null;
  admin: FleetNavGroup | null;
  bot?: FleetNavGroup | null;
  onNavigate?: () => void;
  /** Kept for callers; all variants are now collapsible per group. */
  variant?: "desktop" | "drawer";
};

export function FleetSidebarNav({
  groups,
  setup,
  admin,
  bot,
  onNavigate,
}: FleetSidebarNavProps) {
  const pathname = usePathname() ?? "";
  const tx = useT();
  const configGroups = [setup, bot, admin].filter((g): g is FleetNavGroup => g != null);

  return (
    <nav className={`${fleetScrollPaneClass} flex min-h-0 flex-1 flex-col px-2 py-3`} aria-label={tx("nav.aria.fleet")}>
      <div className="flex-1 space-y-1">
        <SidebarSectionLabel label={tx("nav.sections.operations")} />
        {renderNavGroups(groups, pathname, onNavigate)}
      </div>
      {configGroups.length ? (
        <div className="mt-2 border-t border-zinc-800 pt-1">
          <SidebarSectionLabel label={tx("nav.sections.configuration")} />
          {renderNavGroups(configGroups, pathname, onNavigate)}
        </div>
      ) : null}
    </nav>
  );
}
