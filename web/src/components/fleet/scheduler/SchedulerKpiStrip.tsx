import type { AppointmentStats } from "@/lib/appointments-api";

export function SchedulerKpiStrip({ stats }: { stats: AppointmentStats | null }) {
  const items = [
    { label: "Azi", value: stats?.today ?? 0 },
    { label: "Săptămâna", value: stats?.thisWeek ?? 0 },
    { label: "Confirmate", value: stats?.confirmed ?? 0 },
    { label: "De confirmat", value: stats?.scheduled ?? 0 },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">{item.label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-100">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
