import Link from "next/link";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { LogoutButton } from "./logout-button";

export default async function FleetLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthMeResult();
  const write = canManageFleet(auth);

  const authBanner =
    auth.ok === false && auth.kind === "backend_error" ? (
      <div className="border-b border-amber-900/50 bg-amber-950/40 px-6 py-2 text-center text-sm text-amber-100">
        Nu s-a putut încărca rolul din API ({auth.status ?? "?"}). Verifică că Nest rulează și{" "}
        <code className="rounded bg-zinc-950 px-1 font-mono text-xs">API_URL</code> în{" "}
        <code className="rounded bg-zinc-950 px-1 font-mono text-xs">web/.env.local</code>. Acțiunile de scriere
        rămân ascunse până revine răspunsul la <code className="font-mono text-xs">GET /auth/me</code>.
      </div>
    ) : null;

  return (
    <div className="min-h-screen bg-zinc-950">
      {authBanner}
      <header className="border-b border-zinc-800 bg-zinc-950/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <nav className="flex flex-wrap items-center gap-4 text-sm">
            <Link href="/fleet/vehicles" className="font-medium text-zinc-200 hover:text-white">
              Vehicule
            </Link>
            <Link href="/fleet/documents" className="text-zinc-400 hover:text-zinc-200">
              Documente
            </Link>
            <Link href="/fleet/trips" className="text-zinc-400 hover:text-zinc-200">
              Trips
            </Link>
            <Link href="/fleet/maintenance" className="text-zinc-400 hover:text-zinc-200">
              Mentenanță
            </Link>
            <Link href="/fleet/costs" className="text-zinc-400 hover:text-zinc-200">
              Costuri
            </Link>
            {write ? (
              <Link href="/fleet/vehicles/new" className="text-zinc-400 hover:text-zinc-200">
                Nou
              </Link>
            ) : null}
            {auth.ok ? (
              <Link href="/fleet/audit" className="text-zinc-400 hover:text-zinc-200">
                Audit
              </Link>
            ) : null}
            {write ? (
              <Link href="/fleet/members" className="text-zinc-400 hover:text-zinc-200">
                Membri
              </Link>
            ) : null}
            {auth.ok && auth.me.role === "tenant_viewer" ? (
              <span className="rounded-md border border-zinc-700 bg-zinc-900/60 px-2 py-0.5 text-xs text-zinc-400">
                Doar citire
              </span>
            ) : null}
          </nav>
          <LogoutButton />
        </div>
      </header>
      {children}
    </div>
  );
}
