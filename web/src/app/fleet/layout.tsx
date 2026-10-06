import { FleetLayoutSwitcher } from "@/components/fleet/FleetLayoutSwitcher";
import {
  canManageFleet,
  canUseBot,
  driverIdFromAuth,
  getAuthMeResult,
  getDefaultFleetHome,
  getSessionPortalHint,
  isClientDriverPortal,
  isClientFleetPortal,
} from "@/lib/auth-server";
import { shortDisplayName } from "@/lib/driver-portal-server";
import { fleetServerFetch } from "@/lib/fleet-server";
import { getFleetNavForUser } from "@/lib/fleet-nav";

async function loadDriverTopBarProfile(driverId: string | undefined): Promise<{
  displayName?: string;
  photoUrl?: string | null;
}> {
  if (!driverId) return {};
  try {
    const res = await fleetServerFetch(`/drivers/${driverId}`);
    if (!res?.ok) return {};
    const data = (await res.json()) as { driver?: { fullName?: string | null; photoUrl?: string | null } };
    const fullName = data.driver?.fullName?.trim() || null;
    return { displayName: fullName ?? undefined, photoUrl: data.driver?.photoUrl ?? null };
  } catch {
    return {};
  }
}

export default async function FleetLayout({ children }: { children: React.ReactNode }) {
  const [auth, hint] = await Promise.all([getAuthMeResult(), getSessionPortalHint()]);
  const write = canManageFleet(auth);
  const driverPortal = isClientDriverPortal(auth) || hint?.clientPortal === "driver";
  const fleetPortal = isClientFleetPortal(auth) || (!driverPortal && hint?.clientPortal === "fleet");
  const { groups, setup, admin, bot } = getFleetNavForUser({
    canWrite: write,
    authenticated: auth.ok || Boolean(hint),
    demoBot: canUseBot(auth),
    clientDriverPortal: driverPortal,
    clientFleetPortal: fleetPortal,
  });

  const driverId = driverPortal ? driverIdFromAuth(auth) : undefined;
  const driverProfile = driverPortal ? await loadDriverTopBarProfile(driverId) : {};
  const userEmail = auth.ok ? auth.me.email : hint?.email;
  const userDisplayName = driverPortal
    ? shortDisplayName(driverProfile.displayName, userEmail) || userEmail
    : undefined;
  const userPhotoUrl = driverPortal ? driverProfile.photoUrl : undefined;

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
    <FleetLayoutSwitcher
      groups={groups}
      setup={setup}
      admin={admin}
      bot={bot}
      tenantSlug={auth.ok ? auth.me.tenantSlug : undefined}
      userEmail={userEmail}
      userDisplayName={userDisplayName}
      userPhotoUrl={userPhotoUrl}
      readOnly={auth.ok && auth.me.role === "tenant_viewer"}
      authBanner={authBanner}
      homeHref={getDefaultFleetHome(auth, hint)}
      driverPortal={driverPortal}
    >
      {children}
    </FleetLayoutSwitcher>
  );
}
