"use client";

import { useEffect, useRef, useState } from "react";
import { LogoutButton } from "@/app/fleet/logout-button";
import {
  PartnerSupplierSelector,
  type PartnerSupplierOption,
} from "@/components/fleet/partner/PartnerAdminChrome";

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
  const [notifOpen, setNotifOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen && !notifOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuOpen && menuRef.current && !menuRef.current.contains(t)) setMenuOpen(false);
      if (notifOpen && notifRef.current && !notifRef.current.contains(t)) setNotifOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, notifOpen]);

  const notifCount = ctx.notificationCount ?? 0;
  const pending = ctx.pendingTotal ?? 0;

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

        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => {
              setNotifOpen((v) => !v);
              setMenuOpen(false);
            }}
            className="relative rounded-md border border-zinc-800 px-2 py-1 text-[10px] text-zinc-400 hover:bg-zinc-900"
            title="Notificări"
            aria-expanded={notifOpen}
            aria-haspopup="menu"
          >
            🔔
            {notifCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-sky-600 px-0.5 text-[8px] font-bold text-white">
                {notifCount > 9 ? "9+" : notifCount}
              </span>
            ) : null}
          </button>
          {notifOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-zinc-800 bg-zinc-950 py-1 shadow-xl"
            >
              <p className="border-b border-zinc-800 px-3 py-2 text-[10px] font-medium uppercase text-zinc-500">
                Notificări
              </p>
              {pending > 0 ? (
                <p className="px-3 py-2 text-[10px] text-amber-300">
                  {pending} acțiuni în așteptare
                </p>
              ) : (
                <p className="px-3 py-2 text-[10px] text-zinc-500">Nimic în așteptare</p>
              )}
              <a
                href="/fleet/partner/work-orders"
                className="block px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900"
                onClick={() => setNotifOpen(false)}
              >
                Comenzi (WO)
              </a>
              <a
                href="/fleet/partner/appointments"
                className="block px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900"
                onClick={() => setNotifOpen(false)}
              >
                Programări
              </a>
            </div>
          ) : null}
        </div>

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
              className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-zinc-800 bg-zinc-950 py-1 shadow-xl"
            >
              <div className="border-b border-zinc-800 px-3 py-2">
                <p className="truncate text-xs font-medium text-zinc-200">{ctx.userEmail}</p>
                <p className="mt-0.5 text-[10px] text-zinc-500">{ctx.supplierRoleLabel}</p>
                <p className="mt-1 font-mono text-[10px] text-zinc-600">tenant: {ctx.tenantSlug}</p>
              </div>
              {pending > 0 ? (
                <p className="px-3 py-2 text-[10px] text-amber-300">
                  {pending} acțiuni în așteptare
                </p>
              ) : null}
              <div className="border-t border-zinc-800 px-3 py-2">
                <LogoutButton />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
