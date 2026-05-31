import Link from "next/link";
import { redirect } from "next/navigation";
import { ReminderForm } from "@/components/fleet/ReminderForm";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";

type VehiclesPayload = { items: Array<{ id: string; registrationNumber: string; clientId: string }> };
type Props = { searchParams: Promise<{ vehicleId?: string }> };

async function getVehicles() {
  const res = await fleetServerFetch("/fleet/vehicles?page=1&pageSize=200");
  if (!res?.ok) return [];
  const data = (await res.json()) as VehiclesPayload;
  return data.items.map((v) => ({ id: v.id, registrationNumber: v.registrationNumber, clientId: v.clientId }));
}

export default async function NewReminderPage({ searchParams }: Props) {
  const sp = await searchParams;
  const auth = await getAuthMeResult();
  if (!canManageFleet(auth)) redirect("/fleet/reminders");

  const vehicles = await getVehicles();

  return (
    <div className="text-zinc-100">
      <main className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/fleet/reminders" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← Remindere
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">Acțiune reminder nouă</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Leagă de document sau mentenanță existentă, sau creează o acțiune personalizată (ex. schimb distribuție).
        </p>
        <div className="mt-8">
          <ReminderForm mode="create" vehicles={vehicles} defaultVehicleId={sp.vehicleId} />
        </div>
      </main>
    </div>
  );
}
