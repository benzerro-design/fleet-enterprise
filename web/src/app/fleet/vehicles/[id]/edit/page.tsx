import { notFound, redirect } from "next/navigation";
import { VehicleDetailLayout } from "@/components/fleet/VehicleDetailLayout";
import { canManageFleet, canWriteFleetOps, getAuthMeResult } from "@/lib/auth-server";
import { loadVehicleConsumption, loadVehicleDetail } from "@/lib/vehicle-detail-server";
import { getVehicleOptions } from "@/lib/vehicle-options-server";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; periodFrom?: string; periodTo?: string }>;
};

export default async function EditVehiclePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const auth = await getAuthMeResult();

  if (!auth.ok && auth.kind === "backend_error" && auth.status === 401) {
    redirect(`/login?next=${encodeURIComponent(`/fleet/vehicles/${id}/edit`)}`);
  }
  if (!canWriteFleetOps(auth)) {
    redirect(`/fleet/vehicles/${id}`);
  }

  const showConsumption = sp.tab === "consumption";
  const [data, vehicles, consumption] = await Promise.all([
    loadVehicleDetail(id),
    getVehicleOptions(),
    showConsumption ? loadVehicleConsumption(id, sp.periodFrom, sp.periodTo) : Promise.resolve(null),
  ]);
  if (!data) notFound();

  return (
    <VehicleDetailLayout
      data={data}
      vehicles={vehicles}
      editable
      canWrite
      planWrite
      canChangeClient={canManageFleet(auth)}
      consumption={consumption}
      consumptionRequested={showConsumption}
    />
  );
}
