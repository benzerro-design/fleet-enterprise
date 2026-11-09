import Link from "next/link";
import { redirect } from "next/navigation";
import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { GestiuneRequestForm } from "@/components/fleet/GestiuneRequestForm";
import {
  canWriteTickets,
  defaultClientCodeForTickets,
  getAuthMeResult,
} from "@/lib/auth-server";
import { getVehicleOptions } from "@/lib/vehicle-options-server";

type Search = { client?: string; vehicleId?: string };

export default async function NewGestiuneRequestPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const auth = await getAuthMeResult();
  if (!canWriteTickets(auth)) redirect("/fleet/tickets");
  const vehicles = await getVehicleOptions();
  const vehicleFromQuery = sp.vehicleId?.trim()
    ? vehicles.find((v) => v.id === sp.vehicleId!.trim())
    : undefined;
  const defaultClient =
    sp.client ?? vehicleFromQuery?.clientId ?? defaultClientCodeForTickets(auth) ?? "";

  return (
    <FleetPageMain>
      <div className="mb-6 px-4 lg:px-6">
        <Link href="/fleet/tickets" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← Tichete CRM
        </Link>
      </div>
      <div className="px-4 lg:px-6">
        <GestiuneRequestForm
          vehicles={vehicles}
          initialClientId={defaultClient}
          initialVehicleId={sp.vehicleId?.trim() ?? ""}
        />
      </div>
    </FleetPageMain>
  );
}
