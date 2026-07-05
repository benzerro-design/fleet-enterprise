import type { WorkOrderStats } from "@/lib/work-orders-api";

type Props = {
  stats: WorkOrderStats;
};

export function WorkOrderKpiStrip({ stats }: Props) {
  const items = [
    { label: "Deschise", value: stats.open, warn: false },
    { label: "Așteaptă aprobare", value: stats.pendingApproval, warn: stats.pendingApproval > 0 },
    { label: "În lucru", value: stats.inProgress, warn: false },
    { label: "Așteaptă piese", value: stats.waitingParts, warn: stats.waitingParts > 0 },
    { label: "Gata, nefacturat", value: stats.readyUninvoiced, warn: stats.readyUninvoiced > 0 },
    { label: "Finalizate", value: stats.done, warn: false },
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
