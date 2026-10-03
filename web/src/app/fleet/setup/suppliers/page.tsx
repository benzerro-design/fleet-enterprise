import { redirect } from "next/navigation";
import { SetupShell } from "@/components/fleet/setup/SetupShell";
import { SupplierSettingsEditor } from "@/components/fleet/setup/SupplierSettingsEditor";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { apiServerFetch } from "@/lib/fleet-server";
import {
  DEFAULT_SUPPLIER_SETTINGS,
  type SupplierSettings,
} from "@/lib/supplier-settings";

async function loadSettings(): Promise<SupplierSettings> {
  try {
    const res = await apiServerFetch("/tenant/supplier-settings");
    if (!res?.ok) return DEFAULT_SUPPLIER_SETTINGS;
    return (await res.json()) as SupplierSettings;
  } catch {
    return DEFAULT_SUPPLIER_SETTINGS;
  }
}

export default async function SetupSuppliersPage() {
  const auth = await getAuthMeResult();
  if (!canManageFleet(auth)) redirect("/fleet/vehicles");
  const settings = await loadSettings();

  return (
    <FleetPageMain className="min-h-0">
      <SetupShell
        title="Furnizori"
        description="Checklist onboarding, categorii editabile și politici de compliance pe comenzi — pe tot abonatul."
      >
        <SupplierSettingsEditor initial={settings} />
      </SetupShell>
    </FleetPageMain>
  );
}
