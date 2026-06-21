import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { OpsFormLayout } from "@/components/fleet/OpsFormLayout";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CostForm } from "@/components/fleet/CostForm";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";
import { getVehicleOptions } from "@/lib/vehicle-options-server";
import type { FuelTypeValue } from "@/lib/fuel-types";

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
  fuelProductType?: FuelTypeValue | null;
  nextDueOn?: string | null;
  reminderOffsetsDays?: number[] | null;
  dueOdometerKm?: number | null;
  reminderOffsetsKm?: number[] | null;
  reminderMenuSyncEnabled?: boolean;
};

async function getEntry(id: string): Promise<CostRecord | null> {
  const res = await fleetServerFetch(`/costs/${id}`);
  if (!res || res.status === 404 || !res.ok) return null;
  return (await res.json()) as CostRecord;
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
    <FleetPageMain>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Operațional</p>
        <Link
          href="/fleet/costs"
          className="inline-flex w-fit items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
        >
          Înapoi la listă
        </Link>
      </div>
      <OpsFormLayout
        module="costs"
        mode="edit"
        formTitle="Editare cost"
        vehicles={vehicles}
        defaultVehicleId={entry.vehicleId}
      >
        <CostForm mode="edit" entryId={id} initial={entry} vehicles={vehicles} />
      </OpsFormLayout>
    </FleetPageMain>
  );
}
