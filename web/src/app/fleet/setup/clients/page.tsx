import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SetupClientsPageClient } from "@/components/fleet/setup/SetupClientsPageClient";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { apiServerFetch } from "@/lib/fleet-server";
import type { TenantServiceTypesResponse } from "@/lib/tenant-service-types/types";

async function loadServiceTypes(): Promise<TenantServiceTypesResponse | null> {
  try {
    const res = await apiServerFetch("/tenant/service-types");
    if (!res?.ok) return null;
    return (await res.json()) as TenantServiceTypesResponse;
  } catch {
    return null;
  }
}

export default async function SetupClientsPage() {
  const auth = await getAuthMeResult();
  if (!canManageFleet(auth)) {
    redirect("/fleet/vehicles");
  }

  const data = await loadServiceTypes();

  return (
    <FleetPageMain className="min-h-0">
      {!data ? (
        <p className="text-amber-400">
          Nu am putut încărca catalogul. Verifică API-ul și migrarea{" "}
          <code className="font-mono text-zinc-400">20260713120000_tenant_service_types</code>.
        </p>
      ) : (
        <Suspense fallback={<p className="text-zinc-500">Se încarcă…</p>}>
          <SetupClientsPageClient initialItems={data.items} />
        </Suspense>
      )}
    </FleetPageMain>
  );
}
