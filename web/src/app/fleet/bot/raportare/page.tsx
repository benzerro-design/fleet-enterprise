import Link from "next/link";
import { redirect } from "next/navigation";
import { BotSessionCard } from "@/components/fleet/bot/BotSessionReport";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { canUseBot, getAuthMeResult } from "@/lib/auth-server";
import type { BotSessionRecord } from "@/lib/bot-api";
import { fleetServerFetch } from "@/lib/fleet-server";

async function loadSessions(): Promise<BotSessionRecord[]> {
  try {
    const res = await fleetServerFetch("/bot/sessions?limit=20");
    if (!res?.ok) return [];
    return (await res.json()) as BotSessionRecord[];
  } catch {
    return [];
  }
}

export default async function BotRaportarePage() {
  const auth = await getAuthMeResult();
  if (!canUseBot(auth)) redirect("/fleet/dashboard");

  const sessions = await loadSessions();

  return (
    <FleetPageMain>
      <div className="mb-8">
        <p className="text-sm font-medium uppercase tracking-widest text-violet-400">BOT</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Raportare</h1>
        <p className="mt-2 text-sm text-zinc-400">Ultimele sesiuni de populare — erori cu link-uri acționabile.</p>
        <Link href="/fleet/bot/date" className="mt-3 inline-block text-sm text-emerald-400 hover:underline">
          ← Date
        </Link>
      </div>

      {sessions.length === 0 ? (
        <p className="text-sm text-zinc-500">Nicio sesiune încă. Rulează o populare din Date.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sessions.map((s) => (
            <BotSessionCard key={s.id} session={s} />
          ))}
        </div>
      )}
    </FleetPageMain>
  );
}
