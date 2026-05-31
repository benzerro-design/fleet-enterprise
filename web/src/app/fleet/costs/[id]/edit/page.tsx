import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CostForm } from "@/components/fleet/CostForm";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";

type CostRecord = {
  id: string;
  vehicleId: string;
  category: string;
  provider: string | null;
  amountCents: number;
  odometerKm: number | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  invoiceAttachmentUrl: string | null;
  incurredOn: string;
  notes: string | null;
  fuelLiters?: number | null;
  nextDueOn?: string | null;
  reminderOffsetsDays?: number[] | null;
  dueOdometerKm?: number | null;
  reminderOffsetsKm?: number[] | null;
  reminderMenuSyncEnabled?: boolean;
};
type VehiclesPayload = { items: Array<{ id: string; registrationNumber: string; clientId: string; odometerKm: number }> };

async function getEntry(id: string): Promise<CostRecord | null> {
  const res = await fleetServerFetch(`/costs/${id}`);
  if (!res || res.status === 404 || !res.ok) return null;
  return (await res.json()) as CostRecord;
}

async function getVehicleOptions() {
  const res = await fleetServerFetch("/fleet/vehicles?page=1&pageSize=200");
  if (!res?.ok) return [];
  const data = (await res.json()) as VehiclesPayload;
  return data.items.map((v) => ({
    id: v.id,
    registrationNumber: v.registrationNumber,
    clientId: v.clientId,
    odometerKm: v.odometerKm,
  }));
}

export default async function EditCostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAuthMeResult();
  if (!auth.ok && auth.kind === "backend_error" && auth.status === 401) {
    redirect(`/login?next=${encodeURIComponent(`/fleet/costs/${id}/edit`)}`);
  }
  if (!canManageFleet(auth)) {
    redirect("/fleet/costs");
  }
  const [entry, vehicles] = await Promise.all([getEntry(id), getVehicleOptions()]);
  if (!entry) notFound();

  return (
    <div className="text-zinc-100">
      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Operațional</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Editare cost</h1>
          </div>
          <Link href="/fleet/costs" className="inline-flex w-fit items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900">
            Înapoi la listă
          </Link>
        </div>
        <CostForm mode="edit" entryId={id} initial={entry} vehicles={vehicles} />
      </main>
    </div>
  );
}
