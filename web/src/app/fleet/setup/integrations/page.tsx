import { redirect } from "next/navigation";
import { SetupShell } from "@/components/fleet/setup/SetupShell";
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
      customConnectors:
        raw.customConnectors ?? DEFAULT_TENANT_INTEGRATIONS_SETTINGS.customConnectors,
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
    <FleetPageMain className="min-h-0">
      <SetupShell
        title="Integrări"
        description="Import Audatex/PDF, catalog piese și lansare comenzi — pe tenant. Credențialele API se adaugă pe măsură ce conectăm furnizorii."
      >
        <IntegrationsSettingsEditor initial={settings} />
      </SetupShell>
    </FleetPageMain>
  );
}
