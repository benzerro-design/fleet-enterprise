import { notFound } from "next/navigation";
import { VehicleDetailLayout } from "@/components/fleet/VehicleDetailLayout";
import {
  canManageFleet,
  canUseClientAcquisition,
  canWriteFleetOps,
  canWriteVehicleMedia,
  getAuthMeResult,
  isClientDriverPortal,
} from "@/lib/auth-server";
import { loadVehicleConsumption, loadVehicleDetail } from "@/lib/vehicle-detail-server";
import { getVehicleOptions } from "@/lib/vehicle-options-server";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; periodFrom?: string; periodTo?: string; fuelTypes?: string }>;
};

export default async function VehicleDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const showConsumption = sp.tab === "consumption";
  const [data, vehicles, auth, consumption] = await Promise.all([
    loadVehicleDetail(id),
    getVehicleOptions(),
    getAuthMeResult(),
    showConsumption
      ? loadVehicleConsumption(id, sp.periodFrom, sp.periodTo, sp.fuelTypes)
      : Promise.resolve(null),
  ]);
  if (!data) notFound();

  const driverPortal = isClientDriverPortal(auth);

  return (
    <VehicleDetailLayout
      data={data}
      vehicles={vehicles}
      editable={false}
      canWrite={canWriteFleetOps(auth)}
      mediaWrite={canWriteVehicleMedia(auth)}
      planWrite={canWriteFleetOps(auth)}
      canChangeClient={canManageFleet(auth)}
      driverPortal={driverPortal}
      consumption={consumption}
      consumptionRequested={showConsumption}
      showAcquisition={
        !driverPortal && canUseClientAcquisition(auth, data.vehicle.clientRefId, data.vehicle.clientId)
      }
      civWrite={false}
    />
  );
}
