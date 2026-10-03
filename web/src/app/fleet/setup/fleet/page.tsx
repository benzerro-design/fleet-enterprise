import { redirect } from "next/navigation";
import { SetupShell } from "@/components/fleet/setup/SetupShell";
import { FleetSettingsEditor } from "@/components/fleet/setup/FleetSettingsEditor";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { apiServerFetch } from "@/lib/fleet-server";
import { DEFAULT_FLEET_SETTINGS, type FleetSettings } from "@/lib/fleet-settings";

async function loadSettings(): Promise<FleetSettings> {
  try {
    const res = await apiServerFetch("/tenant/fleet-settings");
    if (!res?.ok) return DEFAULT_FLEET_SETTINGS;
    return (await res.json()) as FleetSettings;
  } catch {
    return DEFAULT_FLEET_SETTINGS;
  }
}

export default async function SetupFleetPage() {
  const auth = await getAuthMeResult();
  if (!canManageFleet(auth)) redirect("/fleet/vehicles");
  const settings = await loadSettings();

  return (
    <FleetPageMain className="min-h-0">
      <SetupShell
        title="Flotă & vehicule"
        description="Șabloane de remindere, tipuri de documente și echipamente, coloane implicite pe listă — intervalele reale rămân pe vehicul."
      >
        <FleetSettingsEditor initial={settings} />
      </SetupShell>
    </FleetPageMain>
  );
}
