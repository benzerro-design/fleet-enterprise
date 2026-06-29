import { notFound } from "next/navigation";
import { VehicleDetailLayout } from "@/components/fleet/VehicleDetailLayout";
import { canManageFleet, canWriteFleetOps, canWriteVehicleMedia, getAuthMeResult } from "@/lib/auth-server";
import { loadVehicleDetail } from "@/lib/vehicle-detail-server";
import { getVehicleOptions } from "@/lib/vehicle-options-server";

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, vehicles, auth] = await Promise.all([
    loadVehicleDetail(id),
    getVehicleOptions(),
    getAuthMeResult(),
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
    />
  );
}
