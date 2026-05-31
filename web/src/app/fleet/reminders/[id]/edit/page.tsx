import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ReminderForm } from "@/components/fleet/ReminderForm";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import type { ReminderActionRow } from "@/lib/reminder-actions";
import { fleetServerFetch } from "@/lib/fleet-server";

type VehiclesPayload = { items: Array<{ id: string; registrationNumber: string; clientId: string }> };

async function getRow(id: string): Promise<ReminderActionRow | null> {
  const res = await fleetServerFetch(`/reminders/${id}`);
  if (!res?.ok) return null;
  return (await res.json()) as ReminderActionRow;
}

async function getVehicles() {
  const res = await fleetServerFetch("/fleet/vehicles?page=1&pageSize=200");
  if (!res?.ok) return [];
  const data = (await res.json()) as VehiclesPayload;
  return data.items.map((v) => ({ id: v.id, registrationNumber: v.registrationNumber, clientId: v.clientId }));
}

type Props = { params: Promise<{ id: string }> };

export default async function EditReminderPage({ params }: Props) {
  const { id } = await params;
  const [row, auth, vehicles] = await Promise.all([getRow(id), getAuthMeResult(), getVehicles()]);
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
    <div className="text-zinc-100">
      <main className="mx-auto max-w-3xl px-6 py-16">
        <Link href={`/fleet/reminders/${id}`} className="text-sm text-zinc-400 hover:text-zinc-200">
          ← Detaliu
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">Editare reminder</h1>
        <div className="mt-8">
          <ReminderForm mode="edit" reminderId={id} initial={row} vehicles={vehicles} />
        </div>
      </main>
    </div>
  );
}
