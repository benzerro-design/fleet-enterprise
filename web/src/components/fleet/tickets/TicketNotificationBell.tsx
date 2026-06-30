"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ticketsBrowserBase, type TicketNotificationRecord } from "@/lib/tickets-api";

export function TicketNotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<TicketNotificationRecord[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${ticketsBrowserBase}/notifications?unread=1`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items: TicketNotificationRecord[] };
      setItems(data.items ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  async function markAllRead() {
    await fetch(`${ticketsBrowserBase}/notifications/read-all`, { method: "PATCH" });
    setItems([]);
    setOpen(false);
  }

  const unread = items.length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          void load();
        }}
        className="relative rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900"
      >
        Notificări
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-zinc-700 bg-zinc-950 p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-zinc-300">Mențiuni</p>
            {unread > 0 ? (
              <button type="button" onClick={() => void markAllRead()} className="text-[10px] text-sky-400">
                Marchează citite
              </button>
            ) : null}
          </div>
          {items.length === 0 ? (
            <p className="text-xs text-zinc-500">Nicio notificare necitită.</p>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <Link
                    href={`/fleet/tickets/${n.ticketId}`}
                    onClick={() => setOpen(false)}
                    className="block rounded-lg border border-zinc-800 bg-zinc-900/50 px-2 py-2 text-xs hover:bg-zinc-900"
                  >
                    <span className="font-mono text-emerald-400">#{n.ticketDisplayId}</span>
                    <p className="mt-1 text-zinc-300">{n.body}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
