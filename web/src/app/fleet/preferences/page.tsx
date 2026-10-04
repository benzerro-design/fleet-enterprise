"use client";

import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { AppearancePreferencesForm } from "@/components/fleet/AppearancePreferencesForm";
import { useT } from "@/lib/i18n/useT";

export default function PreferencesPage() {
  const tx = useT();

  return (
    <FleetPageMain>
      <div className="max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-widest text-sky-400">{tx("appearance.page.eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{tx("appearance.page.title")}</h1>
        <p className="mt-3 text-zinc-400">{tx("appearance.page.description")}</p>
        <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-6">
          <AppearancePreferencesForm />
        </div>
      </div>
    </FleetPageMain>
  );
}
