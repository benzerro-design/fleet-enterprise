import { FleetShell } from "@/components/fleet/FleetShell";
import { canManageFleet, getAuthMeResult, isClientPortalUser } from "@/lib/auth-server";
import { getFleetNavForUser } from "@/lib/fleet-nav";

export default async function FleetLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthMeResult();
  const write = canManageFleet(auth);
  const clientUserMode = isClientPortalUser(auth);
  const { groups, admin } = getFleetNavForUser({
    canWrite: write,
    authenticated: auth.ok,
    clientUserMode,
  });

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
    <FleetShell
      groups={groups}
      admin={admin}
      tenantSlug={auth.ok ? auth.me.tenantSlug : undefined}
      userEmail={auth.ok ? auth.me.email : undefined}
      readOnly={auth.ok && auth.me.role === "tenant_viewer"}
      authBanner={authBanner}
    >
      {children}
    </FleetShell>
  );
}
