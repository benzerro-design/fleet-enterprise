import { notFound, redirect } from "next/navigation";
import { VehicleDetailLayout } from "@/components/fleet/VehicleDetailLayout";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { loadVehicleDetail } from "@/lib/vehicle-detail-server";
import { getVehicleOptions } from "@/lib/vehicle-options-server";

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAuthMeResult();

  if (!auth.ok && auth.kind === "backend_error" && auth.status === 401) {
    redirect(`/login?next=${encodeURIComponent(`/fleet/vehicles/${id}/edit`)}`);
  }
  if (!canManageFleet(auth)) {
    redirect(`/fleet/vehicles/${id}`);
  }

  const [data, vehicles] = await Promise.all([loadVehicleDetail(id), getVehicleOptions()]);
  if (!data) notFound();

  return <VehicleDetailLayout data={data} vehicles={vehicles} editable canWrite />;
}
