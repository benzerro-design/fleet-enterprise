import { redirect } from "next/navigation";
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
    <FleetPageMain>
      <div className="mb-6">
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Setup · Email</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Setări email outbound</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          From afișat, Reply-To, semnătură și CC pentru trimiterile de daună către asigurător.
        </p>
      </div>
      <MailSettingsEditor initial={settings} />
    </FleetPageMain>
  );
}
