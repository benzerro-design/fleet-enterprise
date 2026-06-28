import type { TicketStats } from "@/lib/tickets-api";

type Props = {
  stats: TicketStats;
};

export function TicketKpiStrip({ stats }: Props) {
  const items = [
    { label: "Deschise", value: stats.open, warn: false },
    { label: "În lucru", value: stats.inProgress, warn: false },
    { label: "Coadă L★", value: stats.lstarQueue, warn: stats.lstarQueue > 0 },
    { label: "Rezolvate 7z", value: stats.resolvedLast7Days, warn: false },
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
