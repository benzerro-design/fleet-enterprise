"use client";

import { useState } from "react";

type Tab = "flow" | "actions" | "history" | "details";

type Props = {
  flow: React.ReactNode;
  actions: React.ReactNode;
  history: React.ReactNode;
  details: React.ReactNode;
  defaultTab?: Tab;
};

const tabs: { id: Tab; label: string }[] = [
  { id: "flow", label: "Flux operațional" },
  { id: "actions", label: "Acțiuni" },
  { id: "history", label: "Istoric" },
  { id: "details", label: "Detalii" },
];

export function TicketSideTabs({ flow, actions, history, details, defaultTab = "flow" }: Props) {
  const [tab, setTab] = useState<Tab>(defaultTab);
  const panel = tab === "flow" ? flow : tab === "actions" ? actions : tab === "history" ? history : details;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30">
      <div className="flex border-b border-zinc-800" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 px-3 py-2.5 text-xs font-medium transition sm:text-sm ${
              tab === t.id ? "border-b-2 border-sky-500 text-sky-200" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="p-4">{panel}</div>
    </div>
  );
}
