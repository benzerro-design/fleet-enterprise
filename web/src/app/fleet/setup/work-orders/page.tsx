import { redirect } from "next/navigation";
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
    <FleetPageMain>
      <div className="mb-6">
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Setup · WO</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Setări comenzi service</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Reguli pentru recepție vehicul (km in / km out) pe comenzile de lucru.
        </p>
      </div>
      <WorkOrderSettingsEditor initial={settings} />
    </FleetPageMain>
  );
}
