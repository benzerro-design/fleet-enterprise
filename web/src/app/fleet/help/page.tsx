import Link from "next/link";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { HELP_ARTICLES } from "@/lib/help-articles";
import { getAuthMeResult, canManageFleet } from "@/lib/auth-server";
import { redirect } from "next/navigation";

export default async function FleetHelpPage() {
  const auth = await getAuthMeResult();
  if (!auth.ok || !canManageFleet(auth)) {
    redirect("/fleet/dashboard");
  }

  return (
    <FleetPageMain narrow="md">
      <div>
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Administrare</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-50">Help</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Ghiduri despre cum funcționează produsul. Faza 1: doar Admin abonat (L*). Separat de
          procedurile de lucru pe firmă (viitor).
        </p>
      </div>

      <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800 bg-zinc-900/40">
        {HELP_ARTICLES.map((a) => (
          <li key={a.slug}>
            <Link
              href={`/fleet/help/${a.slug}`}
              className="block px-4 py-3 transition hover:bg-zinc-900"
            >
              <p className="text-sm font-medium text-zinc-100">{a.title}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{a.summary}</p>
            </Link>
          </li>
        ))}
      </ul>
    </FleetPageMain>
  );
}
