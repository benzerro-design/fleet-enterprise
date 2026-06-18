import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { OpsFormLayout } from "@/components/fleet/OpsFormLayout";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ReminderForm } from "@/components/fleet/ReminderForm";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import type { ReminderActionRow } from "@/lib/reminder-actions";
import { fleetServerFetch } from "@/lib/fleet-server";
import { getVehicleOptions } from "@/lib/vehicle-options-server";

async function getRow(id: string): Promise<ReminderActionRow | null> {
  const res = await fleetServerFetch(`/reminders/${id}`);
  if (!res?.ok) return null;
  return (await res.json()) as ReminderActionRow;
}

type Props = { params: Promise<{ id: string }> };

export default async function EditReminderPage({ params }: Props) {
  const { id } = await params;
  const [row, auth, vehicles] = await Promise.all([getRow(id), getAuthMeResult(), getVehicleOptions()]);
  if (!auth.ok && auth.kind === "backend_error" && auth.status === 401) {
    redirect(`/login?next=${encodeURIComponent(`/fleet/reminders/${id}/edit`)}`);
  }
  if (!canManageFleet(auth)) redirect(`/fleet/reminders/${id}`);
  if (!row) notFound();
  if (row.sourceType === "document") redirect(`/fleet/reminders/${id}`);
  if (row.sourceType === "maintenance") redirect(`/fleet/reminders/${id}`);
  if (row.sourceType === "cost") redirect(`/fleet/reminders/${id}`);
  if (row.sourceType === "vehicle_itp") redirect(`/fleet/vehicles/${row.vehicleId}/edit?tab=basic`);
  if (row.sourceType === "maintenance_plan") {
    redirect(`/fleet/vehicles/${row.vehicleId}/edit?tab=maintenance_plan&planItem=${row.maintenancePlanItemId ?? ""}`);
  }

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
      <OpsFormLayout
        module="reminders"
        mode="edit"
        formTitle="Editare acțiune"
        vehicles={vehicles}
        defaultVehicleId={row.vehicleId}
      >
        <ReminderForm mode="edit" reminderId={id} initial={row} vehicles={vehicles} />
      </OpsFormLayout>
    </FleetPageMain>
  );
}
