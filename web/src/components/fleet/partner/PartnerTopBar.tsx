"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogoutButton } from "@/app/fleet/logout-button";
import { openFleetCommandPalette } from "@/components/fleet/FleetCommandPalette";
import { PartnerNotificationBell } from "@/components/fleet/partner/PartnerNotificationBell";
import { PartnerPendingActionsList } from "@/components/fleet/partner/PartnerPendingActionsList";
import {
  PartnerSupplierSelector,
  type PartnerSupplierOption,
} from "@/components/fleet/partner/PartnerAdminChrome";
import {
  partnerBrowserSupplierQuery,
  partnerPendingActionsBrowserBase,
  type PartnerPendingAction,
} from "@/lib/partner-pending-actions-api";

export type PartnerTopBarContext = {
  pageTitle: string;
  supplierLegalName: string;
  supplierCode: string;
  tenantSlug: string;
  userEmail?: string;
  userInitials: string;
  supplierRoleLabel: string;
  docAlert?: boolean;
  docAlertTitle?: string;
  notificationCount?: number;
  pendingTotal?: number;
  isAdminMode?: boolean;
  adminSuppliers?: PartnerSupplierOption[];
};

type Props = {
  ctx: PartnerTopBarContext;
};

export function PartnerTopBar({ ctx }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pendingItems, setPendingItems] = useState<PartnerPendingAction[]>([]);
  const [pendingCount, setPendingCount] = useState(ctx.pendingTotal ?? 0);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(t)) setMenuOpen(false);
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

  useEffect(() => {
    if (!menuOpen) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${partnerPendingActionsBrowserBase}${partnerBrowserSupplierQuery()}`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { items?: PartnerPendingAction[]; total?: number };
        if (cancelled) return;
        setPendingItems(data.items ?? []);
        if (typeof data.total === "number") setPendingCount(data.total);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [menuOpen]);

  const pending = pendingCount;

  return (
    <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950 px-4 lg:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        <span className="shrink-0 text-sm font-semibold text-zinc-100">{ctx.pageTitle}</span>
        {ctx.isAdminMode && ctx.adminSuppliers?.length ? (
          <>
            <span className="shrink-0 text-[10px] text-zinc-600">·</span>
            <PartnerSupplierSelector suppliers={ctx.adminSuppliers} />
          </>
        ) : (
          <>
            <span className="shrink-0 text-[10px] text-zinc-600">·</span>
            <span
              className="truncate text-[10px] text-zinc-400"
              title={`${ctx.supplierLegalName} · tenant ${ctx.tenantSlug}`}
            >
              {ctx.supplierLegalName}
            </span>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => openFleetCommandPalette()}
          className="hidden items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/50 px-2 py-1 text-[11px] text-zinc-500 hover:border-zinc-700 hover:text-zinc-300 sm:inline-flex"
          aria-label="Căutare rapidă"
        >
          <span>Caută…</span>
          <kbd className="rounded border border-zinc-700 px-1 font-mono text-[9px] text-zinc-600">⌘K</kbd>
        </button>

        <span
          className="font-mono text-[9px] text-zinc-500"
          title={`Cod furnizor · tenant ${ctx.tenantSlug}`}
        >
          {ctx.supplierCode}
        </span>

        {ctx.docAlert ? (
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
            title={ctx.docAlertTitle ?? "Document expiră curând"}
          />
        ) : null}

        <PartnerNotificationBell pendingTotal={pending} />

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-1 rounded-md border border-zinc-800 px-1.5 py-1 hover:bg-zinc-900"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-900/60 text-[10px] font-semibold text-violet-200">
              {ctx.userInitials}
            </span>
            <span className="text-[8px] text-zinc-500">▾</span>
          </button>

          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-1 w-80 rounded-lg border border-zinc-800 bg-zinc-950 py-1 shadow-xl"
            >
              <div className="border-b border-zinc-800 px-3 py-2">
                <p className="truncate text-xs font-medium text-zinc-200">{ctx.userEmail}</p>
                <p className="mt-0.5 text-[10px] text-zinc-500">{ctx.supplierRoleLabel}</p>
                <p className="mt-1 font-mono text-[10px] text-zinc-600">tenant: {ctx.tenantSlug}</p>
              </div>
              {pending > 0 ? (
                <PartnerPendingActionsList
                  items={pendingItems}
                  total={pending}
                  compact
                  onNavigate={() => setMenuOpen(false)}
                />
              ) : null}
              <div className="border-t border-zinc-800 px-3 py-2 space-y-2">
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
