import Link from "next/link";
import { redirect } from "next/navigation";
import { BotDatePanel } from "@/components/fleet/bot/BotDatePanel";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { canUseBot, getAuthMeResult } from "@/lib/auth-server";

export default async function BotDatePage() {
  const auth = await getAuthMeResult();
  if (!canUseBot(auth)) redirect("/fleet/dashboard");

  return (
    <FleetPageMain>
      <div className="mb-8">
        <p className="text-sm font-medium uppercase tracking-widest text-violet-400">BOT</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Date — populare demo</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Configurează operațiile per modul (create / edit / delete). Tenant <code className="text-zinc-300">demo</code>{" "}
          only. Layout responsive — pregătit pentru scenarii mobile.
        </p>
        <Link href="/fleet/bot/raportare" className="mt-3 inline-block text-sm text-emerald-400 hover:underline">
          → Raportare sesiuni
        </Link>
      </div>
      <BotDatePanel />
    </FleetPageMain>
  );
}
