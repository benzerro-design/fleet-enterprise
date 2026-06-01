import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DocumentForm } from "@/components/fleet/DocumentForm";
import { canManageFleet, getAuthMeResult } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";

type DocumentRecord = {
  id: string;
  vehicleId: string;
  documentTypeCode: string;
  title: string;
  expiresOn: string | null;
  fileUrl: string | null;
  fileName: string | null;
  reminderOffsetsDays: number[] | null;
  dueOdometerKm?: number | null;
  reminderOffsetsKm?: number[] | null;
  reminderMenuSyncEnabled?: boolean;
};

type VehiclesPayload = { items: Array<{ id: string; registrationNumber: string; clientId: string; odometerKm: number }> };

async function getDocument(id: string): Promise<DocumentRecord | null> {
  const res = await fleetServerFetch(`/documents/${id}`);
  if (!res || res.status === 404 || !res.ok) return null;
  return (await res.json()) as DocumentRecord;
}

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

export default async function EditDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAuthMeResult();
  if (!auth.ok && auth.kind === "backend_error" && auth.status === 401) {
    redirect(`/login?next=${encodeURIComponent(`/fleet/documents/${id}/edit`)}`);
  }
  if (!canManageFleet(auth)) {
    redirect("/fleet/documents");
  }
  const [doc, vehicles] = await Promise.all([getDocument(id), getVehicleOptions()]);
  if (!doc) notFound();

  return (
    <FleetPageMain>
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Conformitate</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Editare document</h1>
          </div>
          <Link
            href={`/fleet/documents/${id}`}
            className="inline-flex w-fit items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            Înapoi la detaliu
          </Link>
        </div>
        <DocumentForm mode="edit" documentId={id} initial={doc} vehicles={vehicles} />
    </FleetPageMain>
  );
}
