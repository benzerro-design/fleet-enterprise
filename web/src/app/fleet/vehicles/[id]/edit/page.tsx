import { notFound, redirect } from "next/navigation";
import { VehicleDetailLayout } from "@/components/fleet/VehicleDetailLayout";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { loadVehicleDetail } from "@/lib/vehicle-detail-server";

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAuthMeResult();

  if (!auth.ok && auth.kind === "backend_error" && auth.status === 401) {
    redirect(`/login?next=${encodeURIComponent(`/fleet/vehicles/${id}/edit`)}`);
  }
  if (!canManageFleet(auth)) {
    redirect(`/fleet/vehicles/${id}`);
  }

  const data = await loadVehicleDetail(id);
  if (!data) notFound();

  return <VehicleDetailLayout id={id} data={data} editable canWrite />;
}
