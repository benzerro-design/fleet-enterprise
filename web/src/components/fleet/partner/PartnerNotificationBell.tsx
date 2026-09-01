"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  partnerNotificationKindLabel,
  partnerNotificationsBrowserBase,
  type PartnerNotificationListPayload,
  type PartnerNotificationRecord,
} from "@/lib/partner-notifications-api";
import {
  partnerBrowserSupplierQuery,
  partnerPendingActionsBrowserBase,
  type PartnerPendingAction,
} from "@/lib/partner-pending-actions-api";
import { PartnerPendingActionsList } from "@/components/fleet/partner/PartnerPendingActionsList";

type Props = {
  pendingTotal?: number;
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ro-RO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function supplierQuery(): string {
  return partnerBrowserSupplierQuery();
}

export function PartnerNotificationBell({ pendingTotal = 0 }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PartnerNotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingItems, setPendingItems] = useState<PartnerPendingAction[]>([]);
  const [pendingCount, setPendingCount] = useState(pendingTotal);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const q = supplierQuery();
    try {
      const [notifRes, actionsRes] = await Promise.all([
        fetch(`${partnerNotificationsBrowserBase}${q}`, { cache: "no-store" }),
        fetch(`${partnerPendingActionsBrowserBase}${q}`, { cache: "no-store" }),
      ]);
      if (notifRes.ok) {
        const data = (await notifRes.json()) as PartnerNotificationListPayload;
        setItems(data.items ?? []);
        setUnreadCount(typeof data.unreadCount === "number" ? data.unreadCount : 0);
      }
      if (actionsRes.ok) {
        const data = (await actionsRes.json()) as { items?: PartnerPendingAction[]; total?: number };
        setPendingItems(data.items ?? []);
        setPendingCount(typeof data.total === "number" ? data.total : 0);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function markRead(id: string) {
    await fetch(`${partnerNotificationsBrowserBase}/${id}/read`, { method: "PATCH" });
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function markAllRead() {
    await fetch(`${partnerNotificationsBrowserBase}/read-all${supplierQuery()}`, { method: "PATCH" });
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
  }

  const badge = unreadCount > 0 ? unreadCount : pendingCount;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          void load();
        }}
        className="relative rounded-md border border-zinc-800 px-2 py-1 text-[10px] text-zinc-400 hover:bg-zinc-900"
        title="Notificări"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        Notificări
        {badge > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-sky-600 px-0.5 text-[8px] font-bold text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-80 rounded-lg border border-zinc-800 bg-zinc-950 py-1 shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
            <p className="text-[10px] font-medium uppercase text-zinc-500">Notificări</p>
            {unreadCount > 0 ? (
              <button type="button" onClick={() => void markAllRead()} className="text-[10px] text-sky-400">
                Marchează citite
              </button>
            ) : null}
          </div>
          {items.length === 0 ? (
            <p className="px-3 py-2 text-[10px] text-zinc-500">Nicio notificare.</p>
          ) : (
            <ul className="max-h-72 overflow-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    onClick={() => {
                      setOpen(false);
                      if (!n.readAt) void markRead(n.id);
                    }}
                    className={`block px-3 py-2 hover:bg-zinc-900 ${n.readAt ? "opacity-70" : ""}`}
                  >
                    <p className="text-[10px] uppercase tracking-wide text-violet-300">
                      {partnerNotificationKindLabel(n.kind)}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-200">{n.subject}</p>
                    <p className="mt-0.5 text-[10px] text-zinc-500">{formatWhen(n.createdAt)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {pendingCount > 0 ? (
            <PartnerPendingActionsList
              items={pendingItems}
              total={pendingCount}
              onNavigate={() => setOpen(false)}
            />
          ) : null}
          <Link
            href="/fleet/partner/work-orders"
            className="block border-t border-zinc-800 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900"
            onClick={() => setOpen(false)}
          >
            Toate comenzile
          </Link>
          <Link
            href="/fleet/partner/appointments"
            className="block px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900"
            onClick={() => setOpen(false)}
          >
            Programări
          </Link>
        </div>
      ) : null}
    </div>
  );
}
