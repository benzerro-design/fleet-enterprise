import { redirect } from "next/navigation";
import { SetupShell } from "@/components/fleet/setup/SetupShell";
import { ImportCsvRunner } from "@/components/fleet/setup/ImportCsvRunner";
import { ImportSettingsEditor } from "@/components/fleet/setup/ImportSettingsEditor";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { apiServerFetch } from "@/lib/fleet-server";
import { DEFAULT_IMPORT_SETTINGS, type ImportSettings } from "@/lib/import-settings";

async function loadSettings(): Promise<ImportSettings> {
  try {
    const res = await apiServerFetch("/tenant/import-settings");
    if (!res?.ok) return DEFAULT_IMPORT_SETTINGS;
    return (await res.json()) as ImportSettings;
  } catch {
    return DEFAULT_IMPORT_SETTINGS;
  }
}

export default async function SetupImportsPage() {
  const auth = await getAuthMeResult();
  if (!canManageFleet(auth)) redirect("/fleet/vehicles");
  const settings = await loadSettings();

  return (
    <FleetPageMain className="min-h-0">
      <SetupShell
        title="Importuri"
        description="Entități importabile, șabloane CSV, motor upload/dry-run/scriere și istoric job-uri. Conectorii API rămân în Integrări."
      >
        <div className="space-y-8">
          <ImportCsvRunner settings={settings} />
          <ImportSettingsEditor initial={settings} />
        </div>
      </SetupShell>
    </FleetPageMain>
  );
}
