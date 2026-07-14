import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { TicketForm } from "@/components/fleet/TicketForm";
import { canWriteTickets, defaultClientCodeForTickets, getAuthMeResult } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";
import type { TenantServiceTypesResponse } from "@/lib/tenant-service-types/types";
import { getVehicleOptions } from "@/lib/vehicle-options-server";

async function loadServiceTypes(): Promise<TenantServiceTypesResponse["items"]> {
  try {
    const res = await fleetServerFetch("/tenant/service-types/active");
    if (!res?.ok) return [];
    const payload = (await res.json()) as TenantServiceTypesResponse;
    return payload.items;
  } catch {
    return [];
  }
}

type Search = {
  client?: string;
  vehicleId?: string;
  reminderActionId?: string;
  subject?: string;
};

export default async function NewTicketPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const auth = await getAuthMeResult();
  if (!canWriteTickets(auth)) redirect("/fleet/tickets");
  const vehicles = await getVehicleOptions();
  const serviceTypes = await loadServiceTypes();
  const defaultClient = sp.client ?? defaultClientCodeForTickets(auth);

  return (
    <FleetPageMain>
      <div className="mb-8">
        <Link href="/fleet/tickets" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← Tichete CRM
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">Solicitare nouă</h1>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Se încarcă formularul…</p>}>
        <TicketForm
          vehicles={vehicles}
          serviceTypes={serviceTypes}
          lockClient={Boolean(defaultClient)}
          initial={{
            clientId: defaultClient,
            vehicleId: sp.vehicleId,
            reminderActionId: sp.reminderActionId,
            subject: sp.subject,
          }}
        />
      </Suspense>
    </FleetPageMain>
  );
}
