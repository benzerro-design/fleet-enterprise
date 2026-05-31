import Link from "next/link";
import { redirect } from "next/navigation";
import { DocumentForm } from "@/components/fleet/DocumentForm";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";

type VehiclesPayload = { items: Array<{ id: string; registrationNumber: string; clientId: string; odometerKm: number }> };

type Props = { searchParams: Promise<{ vehicleId?: string }> };

async function getVehicleOptions() {
  const res = await fleetServerFetch("/fleet/vehicles?page=1&pageSize=200");
  if (!res?.ok) return [];
  const data = (await res.json()) as VehiclesPayload;
  return data.items.map((v) => ({
    id: v.id,
    registrationNumber: v.registrationNumber,
    clientId: v.clientId,
    odometerKm: v.odometerKm,
  }));
}

export default async function NewDocumentPage({ searchParams }: Props) {
  const sp = await searchParams;
  const auth = await getAuthMeResult();
  if (!auth.ok && auth.kind === "backend_error" && auth.status === 401) {
    redirect("/login?next=/fleet/documents/new");
  }
  if (!canManageFleet(auth)) {
    redirect("/fleet/documents");
  }
  const vehicles = await getVehicleOptions();

  return (
    <div className="text-zinc-100">
      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Conformitate</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Document nou</h1>
          </div>
          <Link
            href="/fleet/documents"
            className="inline-flex w-fit items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            Înapoi la listă
          </Link>
        </div>
        <DocumentForm mode="create" vehicles={vehicles} defaultVehicleId={sp.vehicleId} />
      </main>
    </div>
  );
}
