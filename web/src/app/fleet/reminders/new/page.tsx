import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { OpsFormLayout } from "@/components/fleet/OpsFormLayout";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ReminderForm } from "@/components/fleet/ReminderForm";
import { canWriteFleetOps, getAuthMeResult } from "@/lib/auth-server";
import { getVehicleOptions } from "@/lib/vehicle-options-server";

export default async function NewReminderPage({ searchParams }: { searchParams: Promise<{ vehicleId?: string }> }) {
  const sp = await searchParams;
  const auth = await getAuthMeResult();
  if (!auth.ok && auth.kind === "backend_error" && auth.status === 401) {
    redirect("/login?next=/fleet/reminders/new");
  }
  if (!canWriteFleetOps(auth)) {
    redirect("/fleet/reminders");
  }
  const vehicles = await getVehicleOptions();

  return (
    <FleetPageMain>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Operațional</p>
        <Link
          href="/fleet/reminders"
          className="inline-flex w-fit items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
        >
          Înapoi la listă
        </Link>
      </div>
      <p className="mb-6 text-sm text-zinc-500">
        Leagă de document sau mentenanță existentă, sau creează o acțiune personalizată.
      </p>
      <OpsFormLayout module="reminders" formTitle="Acțiune nouă" vehicles={vehicles} defaultVehicleId={sp.vehicleId}>
        <ReminderForm mode="create" vehicles={vehicles} defaultVehicleId={sp.vehicleId} />
      </OpsFormLayout>
    </FleetPageMain>
  );
}
