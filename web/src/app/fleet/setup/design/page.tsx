import { redirect } from "next/navigation";
import { DesignPreferencesForm } from "@/components/fleet/AppearancePreferencesForm";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { SetupShell } from "@/components/fleet/setup/SetupShell";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";

export default async function SetupDesignPage() {
  const auth = await getAuthMeResult();
  if (!canManageFleet(auth)) redirect("/fleet/vehicles");

  return (
    <FleetPageMain className="min-h-0">
      <SetupShell
        title="Design"
        description="Pattern-uri de interfață curate (taburi profil vehicul, etc.). Adăugăm opțiuni când ne lovim de ele — nu editor liber. Valorile se salvează pe acest dispozitiv; branding tenant e un track separat, dacă apare."
      >
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-6">
          <DesignPreferencesForm />
        </div>
      </SetupShell>
    </FleetPageMain>
  );
}
