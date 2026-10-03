import { redirect } from "next/navigation";
import { SetupShell } from "@/components/fleet/setup/SetupShell";
import { MailSettingsEditor } from "@/components/fleet/setup/MailSettingsEditor";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { apiServerFetch } from "@/lib/fleet-server";
import {
  DEFAULT_TENANT_MAIL_SETTINGS,
  type TenantMailSettings,
} from "@/lib/mail-settings";

async function loadSettings(): Promise<TenantMailSettings> {
  try {
    const res = await apiServerFetch("/tenant/mail-settings");
    if (!res?.ok) return DEFAULT_TENANT_MAIL_SETTINGS;
    return (await res.json()) as TenantMailSettings;
  } catch {
    return DEFAULT_TENANT_MAIL_SETTINGS;
  }
}

export default async function SetupMailPage() {
  const auth = await getAuthMeResult();
  if (!canManageFleet(auth)) {
    redirect("/fleet/vehicles");
  }

  const settings = await loadSettings();

  return (
    <FleetPageMain className="min-h-0">
      <SetupShell
        title="Email"
        description="From afișat, Reply-To, semnătură și CC pentru trimiterile outbound (inclusiv daune către asigurător)."
      >
        <MailSettingsEditor initial={settings} />
      </SetupShell>
    </FleetPageMain>
  );
}
