"use client";

import { supplierDotClass } from "./supplier-colors";

type SupplierOption = { id: string; code: string; legalName: string; category: string };

type Props = {
  suppliers: SupplierOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  weekLabel: string;
};

export function SchedulerSidebar({ suppliers, selectedIds, onToggle, weekLabel }: Props) {
  return (
    <aside className="hidden w-52 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950/80 p-3 lg:flex">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Săptămâna</p>
      <p className="mt-1 text-sm font-medium text-zinc-200">{weekLabel}</p>
      <div className="my-4 border-t border-zinc-800" />
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Furnizori</p>
      <ul className="space-y-1 overflow-y-auto">
        {suppliers.map((s) => {
          const on = selectedIds.includes(s.id);
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onToggle(s.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                  on ? "bg-zinc-800/80 text-zinc-100" : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
                }`}
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${on ? supplierDotClass(s.category) : "bg-zinc-700"}`} />
                <span className="min-w-0 truncate">
                  <span className="font-medium">{s.code}</span>
                  <span className="block truncate text-[10px] text-zinc-500">{s.legalName}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
