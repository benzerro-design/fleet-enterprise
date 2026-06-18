import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { OpsFormLayout } from "@/components/fleet/OpsFormLayout";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MaintenanceForm } from "@/components/fleet/MaintenanceForm";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";
import { getVehicleOptions } from "@/lib/vehicle-options-server";

type MaintenanceRecord = {
  id: string;
  vehicleId: string;
  title: string;
  provider: string | null;
  costAllocationCode: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  invoiceAttachmentUrl: string | null;
  performedAt: string | null;
  odometerKm: number | null;
  notes: string | null;
  costCents: number | null;
  warrantyRepair?: boolean;
  potentialCostCents?: number | null;
  damageClaimFileNumber?: string | null;
  insurerName?: string | null;
  nextDueOn?: string | null;
  reminderOffsetsDays?: number[] | null;
  dueOdometerKm?: number | null;
  reminderOffsetsKm?: number[] | null;
  reminderMenuSyncEnabled?: boolean;
};

async function getEntry(id: string): Promise<MaintenanceRecord | null> {
  const res = await fleetServerFetch(`/maintenance/${id}`);
  if (!res || res.status === 404 || !res.ok) return null;
  return (await res.json()) as MaintenanceRecord;
}

export default async function EditMaintenancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAuthMeResult();
  if (!auth.ok && auth.kind === "backend_error" && auth.status === 401) {
    redirect(`/login?next=${encodeURIComponent(`/fleet/maintenance/${id}/edit`)}`);
  }
  if (!canManageFleet(auth)) {
    redirect("/fleet/maintenance");
  }
  const [entry, vehicles] = await Promise.all([getEntry(id), getVehicleOptions()]);
  if (!entry) notFound();

  return (
    <FleetPageMain>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Operațional</p>
        <Link
          href="/fleet/maintenance"
          className="inline-flex w-fit items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
        >
          Înapoi la listă
        </Link>
      </div>
      <OpsFormLayout
        module="maintenance"
        mode="edit"
        formTitle="Editare intervenție"
        vehicles={vehicles}
        defaultVehicleId={entry.vehicleId}
      >
        <MaintenanceForm mode="edit" entryId={id} initial={entry} vehicles={vehicles} />
      </OpsFormLayout>
    </FleetPageMain>
  );
}
