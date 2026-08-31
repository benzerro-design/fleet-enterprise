import { notFound } from "next/navigation";
import { VehicleDetailLayout } from "@/components/fleet/VehicleDetailLayout";
import { canManageFleet, canWriteFleetOps, canWriteVehicleMedia, getAuthMeResult } from "@/lib/auth-server";
import { loadVehicleConsumption, loadVehicleDetail } from "@/lib/vehicle-detail-server";
import { getVehicleOptions } from "@/lib/vehicle-options-server";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; periodFrom?: string; periodTo?: string }>;
};

export default async function VehicleDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const showConsumption = sp.tab === "consumption";
  const [data, vehicles, auth, consumption] = await Promise.all([
    loadVehicleDetail(id),
    getVehicleOptions(),
    getAuthMeResult(),
    showConsumption ? loadVehicleConsumption(id, sp.periodFrom, sp.periodTo) : Promise.resolve(null),
  ]);
  if (!data) notFound();

  return (
    <VehicleDetailLayout
      data={data}
      vehicles={vehicles}
      editable={false}
      canWrite={canWriteFleetOps(auth)}
      mediaWrite={canWriteVehicleMedia(auth)}
      planWrite={canWriteFleetOps(auth)}
      canChangeClient={canManageFleet(auth)}
      consumption={consumption}
      consumptionRequested={showConsumption}
    />
  );
}
