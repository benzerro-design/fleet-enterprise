import { notFound } from "next/navigation";
import { VehicleDetailLayout } from "@/components/fleet/VehicleDetailLayout";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { loadVehicleDetail } from "@/lib/vehicle-detail-server";

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, auth] = await Promise.all([loadVehicleDetail(id), getAuthMeResult()]);
  if (!data) notFound();

  return (
    <VehicleDetailLayout id={id} data={data} editable={false} canWrite={canManageFleet(auth)} />
  );
}
