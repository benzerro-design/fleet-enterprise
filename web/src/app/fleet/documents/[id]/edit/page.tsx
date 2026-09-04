import { FleetPageMain } from "@/components/fleet/FleetPageMain";
import { OpsFormLayout } from "@/components/fleet/OpsFormLayout";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DocumentForm } from "@/components/fleet/DocumentForm";
import { canWriteFleetOps, getAuthMeResult } from "@/lib/auth-server";
import { fleetServerFetch } from "@/lib/fleet-server";
import { getVehicleOptions } from "@/lib/vehicle-options-server";

type DocumentRecord = {
  id: string;
  vehicleId: string;
  documentTypeCode: string;
  title: string;
  expiresOn: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileUrlVerso?: string | null;
  fileNameVerso?: string | null;
  reminderOffsetsDays: number[] | null;
  dueOdometerKm?: number | null;
  reminderOffsetsKm?: number[] | null;
  reminderMenuSyncEnabled?: boolean;
};

async function getDocument(id: string): Promise<DocumentRecord | null> {
  const res = await fleetServerFetch(`/documents/${id}`);
  if (!res || res.status === 404 || !res.ok) return null;
  return (await res.json()) as DocumentRecord;
}

export default async function EditDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAuthMeResult();
  if (!auth.ok && auth.kind === "backend_error" && auth.status === 401) {
    redirect(`/login?next=${encodeURIComponent(`/fleet/documents/${id}/edit`)}`);
  }
  if (!canWriteFleetOps(auth)) {
    redirect("/fleet/documents");
  }
  const [doc, vehicles] = await Promise.all([getDocument(id), getVehicleOptions()]);
  if (!doc) notFound();

  return (
    <FleetPageMain>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">Conformitate</p>
        <Link
          href="/fleet/documents"
          className="inline-flex w-fit items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
        >
          Înapoi la listă
        </Link>
      </div>
      <OpsFormLayout
        module="documents"
        mode="edit"
        formTitle="Editare document"
        vehicles={vehicles}
        defaultVehicleId={doc.vehicleId}
      >
        <DocumentForm mode="edit" documentId={id} initial={doc} vehicles={vehicles} />
      </OpsFormLayout>
    </FleetPageMain>
  );
}
