import { redirect } from "next/navigation";
import { IntegrationsSettingsEditor } from "@/components/fleet/setup/IntegrationsSettingsEditor";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { apiServerFetch } from "@/lib/fleet-server";
import {
  DEFAULT_TENANT_INTEGRATIONS_SETTINGS,
  type TenantIntegrationsSettings,
} from "@/lib/integrations-settings";

async function loadSettings(): Promise<TenantIntegrationsSettings> {
  try {
    const res = await apiServerFetch("/tenant/integrations-settings");
    if (!res?.ok) return DEFAULT_TENANT_INTEGRATIONS_SETTINGS;
    const raw = (await res.json()) as Partial<TenantIntegrationsSettings>;
    return {
      ...DEFAULT_TENANT_INTEGRATIONS_SETTINGS,
      ...raw,
      partsCatalogProviders:
        raw.partsCatalogProviders ?? DEFAULT_TENANT_INTEGRATIONS_SETTINGS.partsCatalogProviders,
      interCars: {
        ...DEFAULT_TENANT_INTEGRATIONS_SETTINGS.interCars,
        ...(raw.interCars ?? {}),
      },
    };
  } catch {
    return DEFAULT_TENANT_INTEGRATIONS_SETTINGS;
  }
}

export default async function SetupIntegrationsPage() {
  const auth = await getAuthMeResult();
  if (!canManageFleet(auth)) {
    redirect("/fleet/vehicles");
  }

  const settings = await loadSettings();

  return (
    <FleetPageMain>
      <div className="mb-6">
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Setup · Integrări</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Integrări externe</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Import Audatex/PDF, catalog piese și lansare comenzi — pe tenant. Credențialele API vin pe măsură ce
          conectăm furnizorii.
        </p>
      </div>
      <IntegrationsSettingsEditor initial={settings} />
    </FleetPageMain>
  );
}
