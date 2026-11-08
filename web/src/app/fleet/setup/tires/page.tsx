import { redirect } from "next/navigation";
import { SetupShell } from "@/components/fleet/setup/SetupShell";
import { TireSettingsEditor } from "@/components/fleet/setup/TireSettingsEditor";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { apiServerFetch } from "@/lib/fleet-server";
import { DEFAULT_TIRE_SETTINGS, parseTireSettings, type TireSettings } from "@/lib/tire-settings";

async function loadSettings(): Promise<TireSettings> {
  try {
    const res = await apiServerFetch("/tenant/tire-settings");
    if (!res?.ok) return DEFAULT_TIRE_SETTINGS;
    return parseTireSettings(await res.json());
  } catch {
    return DEFAULT_TIRE_SETTINGS;
  }
}

export default async function SetupTiresPage() {
  const auth = await getAuthMeResult();
  if (!canManageFleet(auth)) redirect("/fleet/vehicles");
  const settings = await loadSettings();

  return (
    <FleetPageMain className="min-h-0">
      <SetupShell
        title="Anvelope"
        description="Politică hotel (tarif pe bucată / lună calendaristică) și default-uri pentru fluxul pe seturi — tichet hotel vs schimb sezon pe WO."
      >
        <TireSettingsEditor initial={settings} />
      </SetupShell>
    </FleetPageMain>
  );
}
