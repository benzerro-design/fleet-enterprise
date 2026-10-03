import { redirect } from "next/navigation";
import { SetupShell } from "@/components/fleet/setup/SetupShell";
import { WorkOrderSettingsEditor } from "@/components/fleet/setup/WorkOrderSettingsEditor";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { apiServerFetch } from "@/lib/fleet-server";
import {
  DEFAULT_WORK_ORDER_SETTINGS,
  type WorkOrderSettings,
} from "@/lib/work-order-settings";

async function loadSettings(): Promise<WorkOrderSettings> {
  try {
    const res = await apiServerFetch("/tenant/work-order-settings");
    if (!res?.ok) return DEFAULT_WORK_ORDER_SETTINGS;
    return (await res.json()) as WorkOrderSettings;
  } catch {
    return DEFAULT_WORK_ORDER_SETTINGS;
  }
}

export default async function SetupWorkOrdersPage() {
  const auth = await getAuthMeResult();
  if (!canManageFleet(auth)) {
    redirect("/fleet/vehicles");
  }

  const settings = await loadSettings();

  return (
    <FleetPageMain className="min-h-0">
      <SetupShell
        title="Comenzi (WO)"
        description="Reguli de recepție, garanții implicite, facturare pe deviz și pașii pe dosarul de daună — pentru tot abonatul."
      >
        <WorkOrderSettingsEditor initial={settings} />
      </SetupShell>
    </FleetPageMain>
  );
}
