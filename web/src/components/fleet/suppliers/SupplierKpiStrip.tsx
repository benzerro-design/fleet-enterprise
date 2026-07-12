import type { SupplierStats } from "@/lib/suppliers-api";

type Props = {
  stats: SupplierStats;
};

export function SupplierKpiStrip({ stats }: Props) {
  const items = [
    { label: "Total", value: stats.total, warn: false },
    { label: "Activi", value: stats.active, warn: false },
    { label: "Inactivi", value: stats.inactive, warn: false },
    { label: "Blocați", value: stats.blocked, warn: stats.blocked > 0 },
    { label: "WO deschise", value: stats.openWorkOrders, warn: stats.openWorkOrders > 0 },
  ];

  return (
    <div className="flex flex-wrap gap-3 border-b border-zinc-800 pb-4">
      {items.map((k) => (
        <div
          key={k.label}
          className={`min-w-[5.5rem] rounded-lg border px-3 py-2 ${
            k.warn ? "border-amber-700/50 bg-amber-950/20" : "border-zinc-800 bg-zinc-900/40"
          }`}
        >
          <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{k.label}</div>
          <div className={`mt-0.5 text-lg font-semibold ${k.warn ? "text-amber-200" : "text-zinc-200"}`}>
            {k.value}
          </div>
        </div>
      ))}
    </div>
  );
}
