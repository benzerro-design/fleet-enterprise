import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { AppearancePreferencesForm } from "@/components/fleet/AppearancePreferencesForm";

export default function PreferencesPage() {
  return (
    <FleetPageMain>
      <div className="max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-widest text-sky-400">Cont</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Preferințe</h1>
        <p className="mt-3 text-zinc-400">
          Doar aspect personal pe acest dispozitiv: temă, densitate, mișcare redusă, format dată. Nu e hub
          de setări produs — navigarea rapidă e Ctrl/Cmd+K din shell.
        </p>
        <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-6">
          <AppearancePreferencesForm />
        </div>
      </div>
    </FleetPageMain>
  );
}
