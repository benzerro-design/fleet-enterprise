import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BotSessionDetail } from "@/components/fleet/bot/BotSessionReport";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { canUseBot, getAuthMeResult } from "@/lib/auth-server";
import type { BotSessionRecord } from "@/lib/bot-api";
import { fleetServerFetch } from "@/lib/fleet-server";

async function loadSession(id: string): Promise<BotSessionRecord | null> {
  try {
    const res = await fleetServerFetch(`/bot/sessions/${id}`);
    if (!res?.ok) return null;
    return (await res.json()) as BotSessionRecord;
  } catch {
    return null;
  }
}

export default async function BotSessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAuthMeResult();
  if (!canUseBot(auth)) redirect("/fleet/dashboard");

  const session = await loadSession(id);
  if (!session) notFound();

  return (
    <FleetPageMain>
      <div className="mb-8">
        <Link href="/fleet/bot/raportare" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← Raportare
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Sesiune populare</h1>
        <p className="mt-1 font-mono text-xs text-zinc-500">{session.id}</p>
      </div>
      <BotSessionDetail session={session} />
    </FleetPageMain>
  );
}
