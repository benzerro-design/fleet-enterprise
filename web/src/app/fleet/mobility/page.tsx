import Link from "next/link";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";

export default function MobilityHubPage() {
  return (
    <FleetPageMain>
      <p className="text-sm font-medium uppercase tracking-widest text-violet-400">Mobilitate</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Mobilitate client</h1>
      <p className="mt-3 max-w-2xl text-zinc-400">
        Mașini la schimb și asistență rutieră — eligibilitate după 72h imobilizare în service.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/fleet/mobility/replacement-cars"
          className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 hover:border-violet-500/40"
        >
          <h2 className="font-semibold text-zinc-100">Mașină de schimb</h2>
          <p className="mt-2 text-sm text-zinc-400">Alocări active, rezervări și istoric MOB.</p>
        </Link>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5 opacity-60">
          <h2 className="font-semibold text-zinc-300">Asistență rutieră</h2>
          <p className="mt-2 text-sm text-zinc-500">Modul M2 — în curând.</p>
        </div>
      </div>
    </FleetPageMain>
  );
}
