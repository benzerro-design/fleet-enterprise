"use client";

import Link from "next/link";
import { useState } from "react";
import {
  deleteTicketGridView,
  readTicketGridViews,
  saveTicketGridView,
  ticketViewHref,
  type TicketGridSavedView,
} from "@/lib/ticket-grid-views";

type Props = {
  currentParams: Record<string, string>;
};

export function TicketGridViewsPanel({ currentParams }: Props) {
  const [open, setOpen] = useState(false);
  const [views, setViews] = useState<TicketGridSavedView[]>(() => readTicketGridViews());
  const [name, setName] = useState("");

  function onSave() {
    const next = saveTicketGridView(name, currentParams);
    setViews(next);
    setName("");
  }

  function onDelete(id: string) {
    setViews(deleteTicketGridView(id));
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900"
      >
        Vizualizări…
      </button>
      {open ? (
        <div className="absolute left-0 z-20 mt-2 w-72 rounded-xl border border-zinc-700 bg-zinc-950 p-3 shadow-xl">
          <p className="text-xs font-medium text-zinc-300">Vizualizări salvate</p>
          <div className="mt-2 flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nume vizualizare"
              className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
            />
            <button
              type="button"
              onClick={onSave}
              className="rounded bg-emerald-700 px-2 py-1 text-xs text-white"
            >
              Salvează
            </button>
          </div>
          <ul className="mt-3 max-h-48 space-y-1 overflow-auto">
            {views.length === 0 ? (
              <li className="text-xs text-zinc-500">Nicio vizualizare salvată.</li>
            ) : (
              views.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2">
                  <Link
                    href={ticketViewHref(v.params)}
                    className="truncate text-xs text-sky-300 hover:underline"
                    onClick={() => setOpen(false)}
                  >
                    {v.name}
                  </Link>
                  <button
                    type="button"
                    onClick={() => onDelete(v.id)}
                    className="text-xs text-zinc-500 hover:text-red-400"
                  >
                    ×
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
