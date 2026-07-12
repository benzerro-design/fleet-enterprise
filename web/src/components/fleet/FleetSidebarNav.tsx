"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { fleetScrollPaneClass } from "@/lib/fleet-scroll-styles";
import {
  type FleetNavEntry,
  type FleetNavGroup,
  navEntryIsActive,
  phaseBadgeLabel,
  type FleetNavLink,
} from "@/lib/fleet-nav";

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

function NavLinkItem({ entry, pathname, onNavigate }: { entry: FleetNavLink; pathname: string; onNavigate?: () => void }) {
  const active = navEntryIsActive(pathname, entry);
  return (
    <Link
      href={entry.href}
      onClick={onNavigate}
      className={`flex items-center justify-between gap-2 rounded-md py-2 pl-3 pr-2 text-sm transition-colors ${
        active
          ? "border-l-2 border-emerald-500 bg-zinc-900/80 pl-[10px] font-medium text-zinc-100"
          : "border-l-2 border-transparent text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200"
      }`}
    >
      <span>{entry.label}</span>
    </Link>
  );
}

function NavSoonItem({ entry }: { entry: Extract<FleetNavEntry, { kind: "soon" }> }) {
  return (
    <div
      className="flex cursor-not-allowed items-center justify-between gap-2 rounded-md border-l-2 border-transparent py-2 pl-3 pr-2 text-sm text-zinc-600"
      title={entry.hint ?? "Modul planificat"}
    >
      <span>{entry.label}</span>
      <PhaseBadge phase={entry.phase} />
    </div>
  );
}

function NavGroupBlock({
  group,
  pathname,
  onNavigate,
  defaultOpen,
}: {
  group: FleetNavGroup;
  pathname: string;
  onNavigate?: () => void;
  defaultOpen?: boolean;
}) {
  const hasActive = group.items.some(
    (e) => e.kind === "link" && navEntryIsActive(pathname, e),
  );

  return (
    <details className="group/nav lg:hidden" open={defaultOpen ?? hasActive}>
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-md px-2 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-900/40 [&::-webkit-details-marker]:hidden">
        <span>{group.label}</span>
        <span className="text-xs text-zinc-600 group-open/nav:rotate-180">▾</span>
      </summary>
      <div className="pb-2 pt-1">
        <NavGroupItems group={group} pathname={pathname} onNavigate={onNavigate} />
      </div>
    </details>
  );
}

function NavGroupItems({
  group,
  pathname,
  onNavigate,
}: {
  group: FleetNavGroup;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <p className="hidden px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600 lg:block">
        {group.label}
      </p>
      <ul className="space-y-0.5">
        {group.items.map((entry) => (
          <li key={entry.label}>
            {entry.kind === "link" ? (
              <NavLinkItem entry={entry} pathname={pathname} onNavigate={onNavigate} />
            ) : (
              <NavSoonItem entry={entry} />
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

type FleetSidebarNavProps = {
  groups: FleetNavGroup[];
  setup?: FleetNavGroup | null;
  admin: FleetNavGroup | null;
  bot?: FleetNavGroup | null;
  onNavigate?: () => void;
  /** Mobile drawer: collapsible groups. Desktop: flat group headers. */
  variant?: "desktop" | "drawer";
};

export function FleetSidebarNav({ groups, setup, admin, bot, onNavigate, variant = "desktop" }: FleetSidebarNavProps) {
  const pathname = usePathname() ?? "";

  return (
    <nav className={`${fleetScrollPaneClass} flex min-h-0 flex-1 flex-col px-2 py-3`} aria-label="Navigare flotă">
      <div className="flex-1 space-y-1">
        {groups.map((group) =>
          variant === "drawer" ? (
            <NavGroupBlock key={group.id} group={group} pathname={pathname} onNavigate={onNavigate} />
          ) : (
            <div key={group.id} className="mb-3">
              <NavGroupItems group={group} pathname={pathname} onNavigate={onNavigate} />
            </div>
          ),
        )}
      </div>
      {setup ? (
        <div className="mt-2 border-t border-zinc-800 pt-2">
          {variant === "drawer" ? (
            <NavGroupBlock group={setup} pathname={pathname} onNavigate={onNavigate} defaultOpen />
          ) : (
            <NavGroupItems group={setup} pathname={pathname} onNavigate={onNavigate} />
          )}
        </div>
      ) : null}
      {bot ? (
        <div className="mt-2 border-t border-zinc-800 pt-2">
          {variant === "drawer" ? (
            <NavGroupBlock group={bot} pathname={pathname} onNavigate={onNavigate} defaultOpen />
          ) : (
            <NavGroupItems group={bot} pathname={pathname} onNavigate={onNavigate} />
          )}
        </div>
      ) : null}
      {admin ? (
        <div className="mt-2 border-t border-zinc-800 pt-2">
          {variant === "drawer" ? (
            <NavGroupBlock group={admin} pathname={pathname} onNavigate={onNavigate} defaultOpen />
          ) : (
            <NavGroupItems group={admin} pathname={pathname} onNavigate={onNavigate} />
          )}
        </div>
      ) : null}
    </nav>
  );
}
